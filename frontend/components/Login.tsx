import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { apiPost } from '../api';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<any>('/auth/login', { email, password });

      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onLogin();
      } else {
        setError('Erro ao processar login. Tente novamente.');
      }
    } catch (err: any) {
      setError(err.message || 'Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-gray-900">
      {/* Brand Section */}
      <div className="md:w-1/2 bg-gray-900 text-white flex flex-col justify-center p-12 lg:p-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-4 text-white">Central Afiliado</h1>
          <p className="text-gray-400 text-lg mb-8">Gerencie suas automações, produtos e links de afiliados em um único lugar.</p>
          <ul className="space-y-4 text-sm text-gray-300">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Monitoramento em tempo real</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Gestão centralizada de produtos</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Automação de envio WhatsApp</li>
          </ul>
        </div>
      </div>

      {/* Form Section */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
            <p className="text-gray-500 mt-2">Faça login para acessar o painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2"
            >
              Entrar <ArrowRight size={20} />
            </button>
          </form>
          <p className="text-center text-xs text-gray-400">Protegido por Supabase Auth</p>
        </div>
      </div>
    </div>
  );
};

export default Login;