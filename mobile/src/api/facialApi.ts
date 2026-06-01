import { http, withRetries } from './httpClient';
import type {
  RecognizeFaceResponse,
  RegisterPointFacialRequest,
  RegisterPointFacialResponse,
} from '@/types/api';

interface CapturedFrame {
  uri: string;
  type?: string;
  name?: string;
}

export const FacialApi = {
  /**
   * Envia frame para o backend (Rekognition).
   * Usado como FALLBACK quando matching local falhar e config permitir cloud.
   */
  async recognize(frame: CapturedFrame): Promise<RecognizeFaceResponse> {
    const fd = new FormData();
    fd.append('image', {
      uri: frame.uri,
      type: frame.type ?? 'image/jpeg',
      name: frame.name ?? 'frame.jpg',
    } as unknown as Blob);

    const res = await http().post<RecognizeFaceResponse>('/api/reconhecer_rosto', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 12_000,
    });
    return res.data;
  },

  async registerPoint(
    payload: RegisterPointFacialRequest,
  ): Promise<RegisterPointFacialResponse> {
    const res = await http().post<RegisterPointFacialResponse>(
      '/api/registrar_ponto_facial',
      payload,
      withRetries({}, 2),
    );
    return res.data;
  },
};
