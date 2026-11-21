import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, GitBranch, KeyRound, ShieldCheck, Unlink, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { PRIMARY_BLUE_BTN, SECONDARY_WHITE_BTN } from './ui/PremiumPrimitives.tsx';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function AccountModal({ open, onClose }: AccountModalProps) {
  const { user, updateProfile, connectGitHub, disconnectGitHub } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [roleTitle, setRoleTitle] = useState(user?.roleTitle || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setRoleTitle(user.roleTitle || '');
      setCurrentPassword('');
      setNewPassword('');
      setError('');
      setSavedNotice(false);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavedNotice(false);
    setSaving(true);
    try {
      await updateProfile({
        name,
        roleTitle,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save account settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const providerLabel =
    user.authProvider === 'hybrid'
      ? 'Email + GitHub OAuth'
      : user.authProvider === 'github'
        ? 'GitHub OAuth'
        : 'Email & Password';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B1F3A]/35 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_60px_-12px_rgba(11,31,58,0.22)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-gradient-to-r from-[#F8FAFC] to-[#EFF6FF]/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {user.githubAvatarUrl ? (
                  <img
                    src={user.githubAvatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl border border-[#E2E8F0] object-cover shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] flex items-center justify-center text-[13px] font-semibold text-[#2563EB] shrink-0">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2
                    id="account-modal-title"
                    className="font-display text-[15px] font-semibold text-[#0F172A] truncate"
                  >
                    Account &amp; Authentication
                  </h2>
                  <p className="text-[11px] font-mono text-[#64748B] truncate">
                    {user.email} · {providerLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-white border border-transparent hover:border-[#E2E8F0] transition-all"
                aria-label="Close account modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
              {/* GitHub Connection Section */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-center shrink-0 shadow-2xs">
                    <GitBranch
                      className={`w-4 h-4 ${
                        user.githubConnected ? 'text-[#059669]' : 'text-[#64748B]'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                      {user.githubConnected
                        ? `GitHub connected as @${user.githubUsername}`
                        : 'GitHub OAuth not connected'}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      {user.githubConnected
                        ? 'Private & public repository import enabled'
                        : 'Link GitHub to browse and import private repos'}
                    </p>
                  </div>
                </div>

                {user.githubConnected ? (
                  <button
                    type="button"
                    onClick={() => void disconnectGitHub()}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white hover:border-[#FECDD3] hover:bg-[#FFF1F2] text-[12px] font-medium text-[#475569] hover:text-[#E11D48] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connectGitHub()}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[12px] font-semibold text-[#2563EB] transition-colors whitespace-nowrap shrink-0"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Connect</span>
                  </button>
                )}
              </div>

              {/* Profile & Password Form */}
              <form onSubmit={handleSave} className="space-y-4">
                {error && (
                  <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2.5 text-[12px] font-medium text-[#E11D48]">
                    {error}
                  </div>
                )}
                {savedNotice && (
                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-2.5 text-[12px] font-medium text-[#059669] flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Profile changes persisted to database.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="acc-name"
                      className="flex items-center gap-1.5 text-[12px] font-medium text-[#475569] mb-1.5"
                    >
                      <User className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Display Name</span>
                    </label>
                    <input
                      id="acc-name"
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="acc-role"
                      className="block text-[12px] font-medium text-[#475569] mb-1.5"
                    >
                      Engineering Role
                    </label>
                    <input
                      id="acc-role"
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="e.g. Staff Architect"
                      className="w-full h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-3.5 border-t border-[#E2E8F0] space-y-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0F172A]">
                    <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>
                      {user.hasPassword
                        ? 'Update Password (optional)'
                        : 'Set a Local Password (optional)'}
                    </span>
                  </div>

                  {user.hasPassword && (
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                    />
                  )}
                  <input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={
                      user.hasPassword
                        ? 'New password (min 8 chars)'
                        : 'Add password to sign in with email too'
                    }
                    className="w-full h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#64748B]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                    <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className={`${SECONDARY_WHITE_BTN} h-9 px-3.5 text-[12px]`}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className={`${PRIMARY_BLUE_BTN} h-9 px-4 text-[12px]`}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
