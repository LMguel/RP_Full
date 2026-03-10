import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Avatar,
  Paper,
  Divider,
  Button,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  OpenInNew as OpenInNewIcon,
  Psychology as PsychologyIcon,
  QuestionAnswer as QuestionAnswerIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeLink {
  employee_id: string;
  employee_name: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'clarification' | 'error';
  text: string;
  timestamp: Date;
  employeeLink?: EmployeeLink | null;
}

// ---------------------------------------------------------------------------
// Quick suggestion chips
// ---------------------------------------------------------------------------

const QUICK_SUGGESTIONS = [
  'Quem faltou hoje?',
  'Quem faltou este mês?',
  'Quem chegou atrasado hoje?',
  'Quais funcionários estão cadastrados?',
  'Quem está com saldo negativo?',
];

// ---------------------------------------------------------------------------
// Utility: generate unique id
// ---------------------------------------------------------------------------

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Message bubble component
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: ChatMessage;
  onOpenEmployee: (employeeId: string, employeeName: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onOpenEmployee }) => {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const isClarification = message.role === 'clarification';

  const bubbleBg = isUser
    ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
    : isError
    ? 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)'
    : isClarification
    ? 'linear-gradient(135deg, #e65100 0%, #bf360c 100%)'
    : 'rgba(255,255,255,0.09)';

  const textColor = isUser || isError || isClarification ? '#fff' : 'rgba(255,255,255,0.92)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 12,
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
            flexShrink: 0,
          }}
        >
          <BotIcon sx={{ fontSize: 18 }} />
        </Avatar>
      )}

      <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Bubble */}
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.5,
            background: bubbleBg,
            borderRadius: isUser
              ? '18px 18px 4px 18px'
              : '18px 18px 18px 4px',
            boxShadow: isUser
              ? '0 4px 12px rgba(25, 118, 210, 0.3)'
              : '0 2px 8px rgba(0,0,0,0.2)',
            border: !isUser && !isError && !isClarification ? '1px solid rgba(255,255,255,0.15)' : 'none',
            backdropFilter: !isUser ? 'blur(8px)' : 'none',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: textColor,
              whiteSpace: 'pre-line',
              lineHeight: 1.65,
              fontWeight: isUser ? 500 : 400,
              fontSize: '0.875rem',
            }}
          >
            {message.text}
          </Typography>

          {/* Link de espelho */}
          {message.employeeLink && (
            <Button
              size="small"
              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={() =>
                onOpenEmployee(
                  message.employeeLink!.employee_id,
                  message.employeeLink!.employee_name || 'Funcionário',
                )
              }
              sx={{
                mt: 1,
                color: '#93c5fd',
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                px: 1.5,
                py: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
              }}
            >
              Abrir espelho de {message.employeeLink.employee_name || 'Funcionário'}
            </Button>
          )}
        </Paper>

        {/* Timestamp */}
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.42)', mt: 0.5, px: 0.5, fontSize: '0.68rem' }}
        >
          {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>

      {isUser && (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'rgba(255,255,255,0.18)',
            flexShrink: 0,
          }}
        >
          <PersonIcon sx={{ fontSize: 18, color: 'white' }} />
        </Avatar>
      )}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Empty state with suggestions
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestion }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    style={{ textAlign: 'center', padding: '32px 16px' }}
  >
    <Avatar
      sx={{
        width: 64,
        height: 64,
        background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
        mx: 'auto',
        mb: 2,
        boxShadow: '0 8px 24px rgba(25,118,210,0.35)',
      }}
    >
      <PsychologyIcon sx={{ fontSize: 36 }} />
    </Avatar>
    <Typography variant="h6" fontWeight={600} sx={{ color: 'white' }} gutterBottom>
      Olá! Sou o Assistente RH.
    </Typography>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', mb: 3, maxWidth: 380, mx: 'auto' }}>
      Faça perguntas sobre faltas, atrasos, horas extras e jornada dos colaboradores da sua empresa.
    </Typography>
    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 1.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      Sugestões rápidas
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
      {QUICK_SUGGESTIONS.map((s) => (
        <Chip
          key={s}
          label={s}
          onClick={() => onSuggestion(s)}
          clickable
          size="small"
          sx={{
            bgcolor: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.9)',
            fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.2)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
            cursor: 'pointer',
          }}
        />
      ))}
    </Box>
  </motion.div>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const ChatBotRHPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const addMessage = (
    role: ChatMessage['role'],
    text: string,
    employeeLink?: EmployeeLink | null,
  ) => {
    setMessages((prev) => [
      ...prev,
      { id: genId(), role, text, timestamp: new Date(), employeeLink: employeeLink ?? null },
    ]);
  };

  const handleSend = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setInput('');
    addMessage('user', q);
    setLoading(true);

    try {
      const response = await apiService.chatRH(q);

      if (response.type === 'clarification') {
        addMessage('clarification', response.message);
      } else {
        addMessage('bot', response.message, response.employee_link ?? null);
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error ||
        'Não foi possível obter uma resposta. Tente novamente.';
      addMessage('error', errMsg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleOpenEmployee = (employeeId: string, employeeName: string) => {
    navigate(`/records/employee/${encodeURIComponent(employeeId)}/${encodeURIComponent(employeeName)}`);
  };

  return (
    <Box
      sx={{
        height: 'calc(100vh - 128px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 3 },
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
              boxShadow: '0 4px 14px rgba(25,118,210,0.4)',
            }}
          >
            <QuestionAnswerIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: 'white', lineHeight: 1.2 }}>
              Assistente RH
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              Consultas rápidas sobre ponto e jornada dos colaboradores
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      {/* Chat area */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          px: { xs: 1, sm: 2 },
          py: 1,
          maxWidth: 860,
          width: '100%',
          mx: 'auto',
          alignSelf: 'stretch',
          overflow: 'hidden',
        }}
      >
        {/* Messages scroll container */}
        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            px: { xs: 1, sm: 2 },
            py: 2,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'rgba(255,255,255,0.2)',
              borderRadius: 3,
            },
          }}
        >
          {messages.length === 0 ? (
            <EmptyState onSuggestion={(s) => handleSend(s)} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onOpenEmployee={handleOpenEmployee}
                />
              ))}
            </AnimatePresence>
          )}

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
                  flexShrink: 0,
                }}
              >
                <BotIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: 'rgba(255,255,255,0.09)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '18px 18px 18px 4px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CircularProgress size={14} thickness={5} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Consultando...
                </Typography>
              </Paper>
            </motion.div>
          )}
        </Box>

        {/* Quick suggestions (when there are already messages) */}
        {messages.length > 0 && !loading && (
          <Box
            sx={{
              px: { xs: 1, sm: 2 },
              pb: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.75,
            }}
          >
            {QUICK_SUGGESTIONS.slice(0, 4).map((s) => (
              <Chip
                key={s}
                label={s}
                onClick={() => handleSend(s)}
                clickable
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 500,
                  fontSize: '0.72rem',
                  border: '1px solid rgba(255,255,255,0.18)',
                  height: 26,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        )}

        {/* Input area */}
        <Card
          elevation={0}
          sx={{
            mx: { xs: 1, sm: 2 },
            mb: { xs: 1, sm: 2 },
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            overflow: 'visible',
          }}
        >
          <CardContent sx={{ p: '10px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
              <TextField
                inputRef={inputRef}
                fullWidth
                multiline
                maxRows={4}
                placeholder="Faça uma pergunta sobre ponto ou jornada…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                variant="standard"
                InputProps={{ disableUnderline: true }}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '0.9rem',
                    px: 1.5,
                    py: 1,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    borderRadius: 2,
                    color: 'rgba(255,255,255,0.92)',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'rgba(255,255,255,0.38)',
                    opacity: 1,
                  },
                }}
              />
              <IconButton
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  background:
                    input.trim() && !loading
                      ? 'linear-gradient(135deg, #1976d2, #1565c0)'
                      : 'rgba(255,255,255,0.1)',
                  color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.3)',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    background:
                      input.trim() && !loading
                        ? 'linear-gradient(135deg, #1565c0, #0d47a1)'
                        : 'rgba(255,255,255,0.18)',
                    transform: input.trim() && !loading ? 'scale(1.05)' : 'none',
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.35)' }} />
                ) : (
                  <SendIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </Box>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Typography
          variant="caption"
          sx={{ textAlign: 'center', pb: 1, fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}
        >
          Consultas somente leitura • Dados limitados à sua empresa • Powered by Groq Llama
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatBotRHPage;
