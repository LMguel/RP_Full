import React from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import AuthWrapper from '../sections/auth/AuthWrapper';
import RegisterForm from '../components/RegisterForm';

const RegisterPage: React.FC = () => {
  return (
    <AuthWrapper>
          <RegisterForm />
    </AuthWrapper>
  );
};

export default RegisterPage;
