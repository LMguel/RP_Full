import React from 'react';

const PageLayout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-start justify-center relative overflow-auto">
      {/* Decoração de fundo */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px),
                           radial-gradient(circle at 75% 75%, white 0.5px, transparent 0.5px),
                           radial-gradient(circle at 50% 10%, white 0.8px, transparent 0.8px)`,
          backgroundSize: '100px 100px'
        }}
      />
      
      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-7xl mx-auto py-4 px-4 sm:px-6 md:px-8">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
