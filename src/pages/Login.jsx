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
        staggerChildren: 0.12,
        delayChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 28, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 90,
        damping: 14,
      },
    },
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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #080c14 0%, #0a1020 40%, #0d1525 100%)",
      }}
    >
      {/* ── Animated grid/mesh overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          backgroundPosition: "30px 30px",
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Animated background orbs ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Orb 1 - Cyan top-left */}
        <motion.div
          className="absolute -top-10 -left-10 w-[420px] h-[420px] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(6,182,212,0.35) 0%, rgba(34,211,238,0.12) 60%, transparent 80%)",
          }}
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Orb 2 - Emerald bottom-right */}
        <motion.div
          className="absolute -bottom-16 -right-16 w-[500px] h-[500px] rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(6,182,212,0.1) 60%, transparent 80%)",
          }}
          animate={{
            scale: [1, 1.35, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.2,
          }}
        />
        {/* Orb 3 - Cyan-emerald center */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(34,211,238,0.2) 0%, rgba(16,185,129,0.15) 50%, transparent 80%)",
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.15, 0.5, 0.15],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2.4,
          }}
        />
      </div>

      {/* ── Main content ── */}
      <motion.div
        className="w-full max-w-md relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Logo & Title ── */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-32 h-32 rounded-2xl mb-5 overflow-hidden"
            style={{
              background: "#0a1020",
              boxShadow:
                "0 0 0 3px rgba(6,182,212,0.15), 0 0 30px rgba(6,182,212,0.12), 0 25px 50px rgba(0,0,0,0.5)",
            }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <img
              src="/mp_grupo.jpg"
              alt="MP Grupo"
              className="w-full h-full object-cover"
            />
          </motion.div>
          <motion.h1
            className="text-4xl font-bold mb-2 tracking-tight font-display"
            style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 40%, #10b981 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "none",
              filter: "drop-shadow(0 2px 12px rgba(6,182,212,0.3))",
            }}
          >
            MP GRUPO
          </motion.h1>
          <motion.p
            className="font-medium"
            style={{ color: "#22d3ee" }}
          >
            Sales CRM Platform
          </motion.p>
        </motion.div>

        {/* ── Login Card ── */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-8"
          style={{
            background: "rgba(12, 18, 30, 0.92)",
            border: "1px solid rgba(6,182,212,0.08)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 30px 60px rgba(0,0,0,0.55), 0 0 40px rgba(6,182,212,0.04), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <motion.div variants={itemVariants} className="mb-8">
            <h2 className="text-2xl font-bold mb-2 text-white font-display">
              Bem-vindo de volta
            </h2>
            <p className="font-medium" style={{ color: "#64748b" }}>
              Entre com as suas credenciais
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Email / Code field ── */}
            <motion.div variants={itemVariants}>
              <label
                htmlFor="emailOrCode"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#cbd5e1" }}
              >
                Email ou Codigo de Utilizador
              </label>
              <input
                id="emailOrCode"
                type="text"
                value={emailOrCode}
                onChange={(e) => setEmailOrCode(e.target.value)}
                placeholder="seu@email.com ou D2D1015_1"
                required
                data-testid="email-input"
                className="w-full px-4 py-3 rounded-xl border transition-all focus:outline-none text-white"
                style={{
                  fontSize: "15px",
                  borderColor: "rgba(51,65,85,0.6)",
                  backgroundColor: "rgba(8,12,20,0.8)",
                  color: "#f1f5f9",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#06b6d4";
                  e.target.style.boxShadow = "0 0 0 4px rgba(6,182,212,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(51,65,85,0.6)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <p
                className="text-xs mt-1.5 font-medium"
                style={{ color: "#475569" }}
              >
                Pode usar o seu email ou codigo de utilizador para entrar
              </p>
            </motion.div>

            {/* ── Password field ── */}
            <motion.div variants={itemVariants}>
              <label
                htmlFor="password"
                className="block text-sm font-semibold mb-2"
                style={{ color: "#cbd5e1" }}
              >
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
                  className="w-full px-4 py-3 pr-12 rounded-xl border transition-all focus:outline-none text-white"
                  style={{
                    fontSize: "15px",
                    borderColor: "rgba(51,65,85,0.6)",
                    backgroundColor: "rgba(8,12,20,0.8)",
                    color: "#f1f5f9",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#06b6d4";
                    e.target.style.boxShadow = "0 0 0 4px rgba(6,182,212,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(51,65,85,0.6)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors p-1"
                  style={{ color: "#64748b" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                  data-testid="toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* ── Submit button ── */}
            <motion.button
              variants={itemVariants}
              type="submit"
              disabled={loading}
              data-testid="login-button"
              className="w-full py-3.5 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? "rgba(30,41,59,0.8)"
                  : "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                color: loading ? "#64748b" : "#ffffff",
                boxShadow: loading
                  ? "none"
                  : "0 4px 24px rgba(6,182,212,0.3), 0 0 0 1px rgba(6,182,212,0.1)",
              }}
              whileHover={
                !loading
                  ? {
                      scale: 1.02,
                      boxShadow:
                        "0 8px 40px rgba(6,182,212,0.45), 0 0 0 1px rgba(6,182,212,0.2)",
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  A entrar...
                </span>
              ) : (
                "Entrar"
              )}
            </motion.button>
          </form>

          {/* ── Help footer inside card ── */}
          <motion.div
            variants={itemVariants}
            className="mt-6 pt-6"
            style={{ borderTop: "1px solid rgba(6,182,212,0.06)" }}
          >
            <p
              className="text-center text-sm font-medium"
              style={{ color: "#475569" }}
            >
              Problemas ao entrar? Contacte o administrador
            </p>
          </motion.div>
        </motion.div>

        {/* ── Copyright ── */}
        <motion.p
          variants={itemVariants}
          className="text-center text-sm mt-8 font-medium"
          style={{ color: "#64748b" }}
        >
          2025 MP Grupo. Todos os direitos reservados.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
