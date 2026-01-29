import React, { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { authService } from "../lib/auth";

const Login = ({ onLogin }) => {
  const [emailOrCode, setEmailOrCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { user } = await authService.signIn(emailOrCode, password);
      toast.success("Login bem-sucedido!");
      onLogin(user);
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #5c3210 0%, #7B3F00 50%, #8B4513 100%)'
    }}>
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl"
          style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #c9a12e 100%)' }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #b08925 100%)' }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'linear-gradient(135deg, #c9a12e 0%, #D4AF37 100%)' }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.6, 0.2]
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>

      <motion.div
        className="w-full max-w-md relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-32 h-32 rounded-2xl mb-4 shadow-2xl overflow-hidden ring-4 ring-gold-400/30"
            style={{ background: 'linear-gradient(135deg, #FFFDF8 0%, #FFF9ED 100%)' }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <img src="/mp_grupo.jpg" alt="MP Grupo" className="w-full h-full object-cover" />
          </motion.div>
          <motion.h1
            className="text-4xl font-bold mb-2 tracking-tight font-display"
            style={{ color: '#FFFDF8', textShadow: '0 2px 10px rgba(212, 175, 55, 0.4)' }}
          >
            MP GRUPO
          </motion.h1>
          <motion.p className="font-medium text-gold-300">
            Sales CRM Platform
          </motion.p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-2xl shadow-premium p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 253, 248, 0.98) 0%, rgba(255, 249, 237, 0.95) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)'
          }}
        >
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold mb-2 text-chocolate-800 font-display">
              Bem-vindo de volta
            </h2>
            <p className="font-medium text-chocolate-600">
              Entre com as suas credenciais
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div variants={itemVariants}>
              <label htmlFor="emailOrCode" className="block text-sm font-semibold mb-2 text-chocolate-800">
                Email ou Codigo de Parceiro
              </label>
              <input
                id="emailOrCode"
                type="text"
                value={emailOrCode}
                onChange={(e) => setEmailOrCode(e.target.value)}
                placeholder="seu@email.com ou CODIGO"
                required
                data-testid="email-input"
                className="w-full px-4 py-3 rounded-xl border-2 transition-all focus:outline-none"
                style={{
                  fontSize: '15px',
                  borderColor: 'rgba(123, 63, 0, 0.2)',
                  backgroundColor: 'rgba(255, 253, 248, 0.9)',
                  color: '#5c3210'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D4AF37';
                  e.target.style.boxShadow = '0 0 0 4px rgba(212, 175, 55, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(123, 63, 0, 0.2)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p className="text-xs mt-1.5 font-medium text-chocolate-500">
                Pode usar o seu email ou codigo de parceiro para entrar
              </p>
            </motion.div>

            <motion.div variants={itemVariants}>
              <label htmlFor="password" className="block text-sm font-semibold mb-2 text-chocolate-800">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  data-testid="password-input"
                  className="w-full px-4 py-3 pr-12 rounded-xl border-2 transition-all focus:outline-none"
                  style={{
                    fontSize: '15px',
                    borderColor: 'rgba(123, 63, 0, 0.2)',
                    backgroundColor: 'rgba(255, 253, 248, 0.9)',
                    color: '#5c3210'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#D4AF37';
                    e.target.style.boxShadow = '0 0 0 4px rgba(212, 175, 55, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(123, 63, 0, 0.2)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors p-1 text-chocolate-500 hover:text-chocolate-800"
                  data-testid="toggle-password"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            <motion.button
              variants={itemVariants}
              type="submit"
              disabled={loading}
              data-testid="login-button"
              className="w-full py-3.5 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? '#a0a0a0' : 'linear-gradient(135deg, #D4AF37 0%, #c9a12e 100%)',
                color: '#5c3210',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(212, 175, 55, 0.4)'
              }}
              whileHover={!loading ? {
                scale: 1.02,
                boxShadow: '0 6px 30px rgba(212, 175, 55, 0.5)',
                transition: { duration: 0.2 }
              } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  A entrar...
                </span>
              ) : "Entrar"}
            </motion.button>
          </form>

          <motion.div variants={itemVariants} className="mt-6 pt-6 border-t border-chocolate-200/50">
            <p className="text-center text-sm font-medium text-chocolate-500">
              Problemas ao entrar? Contacte o administrador
            </p>
          </motion.div>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-center text-sm mt-8 font-medium text-cream-200/80"
        >
          2025 MP Grupo. Todos os direitos reservados.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
