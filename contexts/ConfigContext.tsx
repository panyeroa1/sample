
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { AppConfig } from '../types';
import * as configService from '../services/configService';

interface ConfigContextType {
  config: AppConfig;
  updateConfig: (newConfig: AppConfig) => void;
  resetConfig: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(configService.getConfig());

  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(configService.getConfig());
    };
    window.addEventListener('eburon-config-changed', handleConfigChange);
    return () => window.removeEventListener('eburon-config-changed', handleConfigChange);
  }, []);

  const updateConfig = (newConfig: AppConfig) => {
    configService.saveConfig(newConfig);
    setConfig(newConfig);
  };

  const resetConfig = () => {
    configService.resetConfig();
    setConfig(configService.getConfig());
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
