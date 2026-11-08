"""Testes dos endpoints de lançamento em lote — sem chamadas AWS reais."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('AWS_DEFAULT_REGION', 'us-east-1')
os.environ.setdefault('AWS_REGION', 'us-east-1')

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from flask import Flask

COMPANY = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
EMP = 'joao_a1b2'
HEADERS = {'Authorization': 'Bearer x'}


def _dia(delta):
    return (datetime.now(ZoneInfo('America/Sao_Paulo')).date() - timedelta(days=delta)).strftime('%Y-%m-%d')


@pytest.fixture
def ctx():
    import routes.api as api

    tabela_reg = MagicMock()
    tabela_func = MagicMock()
    tabela_func.get_item.return_value = {'Item': {
        'id': EMP, 'nome': 'João', 'is_active': True,
        'horario_entrada': '08:00', 'horario_saida': '17:00',
    }}
    tabela_cfg = MagicMock()
    tabela_cfg.get_item.return_value = {'Item': {'intervalo_automatico': True}}
    tabela_reg.batch_writer.return_value.__enter__.return_value = MagicMock()

    app = Flask(__name__)
    app.register_blueprint(api.routes, url_prefix='/api')
    with patch.object(api, 'verify_token', return_value={'company_id': COMPANY, 'usuario_id': 'rh1', 'role': 'OWNER'}), \
         patch.object(api, 'tabela_registros', tabela_reg), \
         patch.object(api, 'tabela_funcionarios', tabela_func), \
         patch.object(api, 'tabela_configuracoes', tabela_cfg), \
         patch.object(api, '_log_audit') as audit, \
         patch.object(api, '_registros_do_periodo', return_value={}) as periodo:
        yield app.test_client(), tabela_reg, audit, periodo


def _post(client, dias, just='Sistema sem internet'):
    return client.post('/api/registrar_ponto_lote', headers=HEADERS,
                       json={'employee_id': EMP, 'justificativa': just, 'dias': dias})


def test_lanca_varios_dias_e_audita_uma_vez(ctx):
    client, tabela, audit, _ = ctx
    resp = _post(client, [
        {'data': _dia(3), 'batidas': ['08:00', '17:00']},
        {'data': _dia(2), 'batidas': ['08:05', '17:10']},
    ])
    assert resp.status_code == 200
    body = resp.get_json()
    assert len(body['lancados']) == 2 and body['ignorados'] == []
    escritor = tabela.batch_writer.return_value.__enter__.return_value
    assert escritor.put_item.call_count == 4
    item = escritor.put_item.call_args_list[0].kwargs['Item']
    assert item['company_id'] == COMPANY and item['origem'] == 'manual_lote' and item['type'] == 'entrada'
    assert audit.call_count == 1


def test_dia_com_batidas_nao_e_alterado_sem_substituir(ctx):
    client, tabela, _, periodo = ctx
    d = _dia(1)
    periodo.return_value = {d: [{'employee_id#date_time': f'{EMP}#{d} 08:00:00', 'type': 'entrada', 'data_hora': f'{d} 08:00:00'}]}
    resp = _post(client, [{'data': d, 'batidas': ['08:00', '17:00']}, {'data': _dia(2), 'batidas': ['08:00', '17:00']}])
    body = resp.get_json()
    assert [i['data'] for i in body['ignorados']] == [d]
    assert len(body['lancados']) == 1
    tabela.update_item.assert_not_called()


def test_substituir_invalida_batidas_antigas(ctx):
    client, tabela, _, periodo = ctx
    d = _dia(1)
    chave = f'{EMP}#{d} 09:00:00'
    periodo.return_value = {d: [{'employee_id#date_time': chave, 'type': 'entrada', 'data_hora': f'{d} 09:00:00'}]}
    resp = _post(client, [{'data': d, 'batidas': ['08:00', '17:00'], 'substituir': True}])
    assert resp.status_code == 200 and resp.get_json()['substituidos'] == [d]
    assert tabela.update_item.call_args.kwargs['Key']['employee_id#date_time'] == chave


def test_dia_de_atestado_nunca_e_sobrescrito(ctx):
    client, tabela, _, periodo = ctx
    d = _dia(1)
    periodo.return_value = {d: [{'employee_id#date_time': f'{EMP}#{d} 00:00:00', 'type': 'atestado', 'data_hora': f'{d} 00:00:00'}]}
    resp = _post(client, [{'data': d, 'batidas': ['08:00', '17:00'], 'substituir': True}])
    assert resp.status_code == 400
    assert 'atestado' in resp.get_json()['ignorados'][0]['motivo'].lower()


def test_rejeita_futuro_impar_e_justificativa_curta(ctx):
    client, *_ = ctx
    futuro = (datetime.now(ZoneInfo('America/Sao_Paulo')).date() + timedelta(days=2)).strftime('%Y-%m-%d')
    resp = _post(client, [{'data': futuro, 'batidas': ['08:00', '17:00']}, {'data': _dia(1), 'batidas': ['08:00']}])
    assert resp.status_code == 400
    assert len(resp.get_json()['ignorados']) == 2
    assert _post(client, [{'data': _dia(1), 'batidas': ['08:00', '17:00']}], just='ok').status_code == 400


def test_previa_marca_situacao_dos_dias(ctx):
    client, _, _, periodo = ctx
    d = _dia(1)
    periodo.return_value = {d: [{'type': 'entrada', 'data_hora': f'{d} 08:00:00'}]}
    resp = client.get(f'/api/ponto_lote/previa?employee_id={EMP}&data_inicio={_dia(2)}&data_fim={d}', headers=HEADERS)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['intervalo_automatico'] is True
    por_data = {x['data']: x for x in body['dias']}
    assert por_data[d]['situacao'] == 'com_batidas' and por_data[d]['batidas_existentes'] == ['08:00']
    assert por_data[_dia(2)]['situacao'] == 'livre'


def test_previa_limita_periodo(ctx):
    client, *_ = ctx
    resp = client.get(f'/api/ponto_lote/previa?employee_id={EMP}&data_inicio={_dia(100)}&data_fim={_dia(0)}', headers=HEADERS)
    assert resp.status_code == 400


def _post_decl(client, **campos):
    dados = {'employee_id': EMP, 'data': _dia(1), 'hora_inicio': '08:00', 'hora_fim': '11:00',
             'justificativa': 'Consulta médica'}
    dados.update(campos)
    return client.post('/api/registrar_declaracao', headers=HEADERS, data=dados, content_type='multipart/form-data')


def test_declaracao_grava_registro_que_nao_e_batida(ctx):
    client, tabela, audit, _ = ctx
    resp = _post_decl(client)
    assert resp.status_code == 200
    item = tabela.put_item.call_args.kwargs['Item']
    assert item['type'] == 'declaracao' and item['abono_minutos'] == 180
    assert item['data_hora'].endswith('00:00:10')
    assert audit.call_count == 1


def test_declaracao_rejeita_sobreposicao_e_periodo_invalido(ctx):
    client, _, _, periodo = ctx
    d = _dia(1)
    periodo.return_value = {d: [{'type': 'declaracao', 'status': 'ATIVO', 'abono_inicio': '09:00', 'abono_fim': '10:00', 'data_hora': f'{d} 00:00:10'}]}
    assert _post_decl(client).status_code == 409
    assert _post_decl(client, hora_inicio='12:00', hora_fim='11:00').status_code == 400
    assert _post_decl(client, justificativa='x').status_code == 400


def test_lote_nao_invalida_declaracao_do_dia(ctx):
    client, tabela, _, periodo = ctx
    d = _dia(1)
    periodo.return_value = {d: [{'employee_id#date_time': f'{EMP}#{d} 00:00:10', 'type': 'declaracao', 'status': 'ATIVO',
                                 'data_hora': f'{d} 00:00:10', 'abono_inicio': '08:00', 'abono_fim': '09:00'}]}
    resp = _post(client, [{'data': d, 'batidas': ['09:00', '17:00']}])
    assert resp.status_code == 200
    tabela.update_item.assert_not_called()
