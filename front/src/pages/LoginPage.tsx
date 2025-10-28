import React from 'react';

import AuthWrapper from '../sections/auth/AuthWrapper';
import LoginForm from '../components/LoginForm';

const LoginPage: React.FC = () => {
  return (
    <AuthWrapper>              
          <LoginForm />
    </AuthWrapper>
  );
};

export default LoginPage;
