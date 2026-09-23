import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  User, 
  Mail, 
  AtSign, 
  Palette, 
  Sparkles, 
  Save, 
  Loader2, 
  ShieldCheck, 
  Contrast,
  Sliders
} from 'lucide-react';
import { UserProfile, AppTheme } from '../../types';
import { api } from '../../services/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  currentTheme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
}

export const AVATAR_COLOR_GRADIENTS: Record<string, { label: string; class: string }> = {
  indigo: { label: 'Indigo & Violet', class: 'from-indigo-500 to-purple-600' },
  purple: { label: 'Purple & Magenta', class: 'from-purple-600 to-pink-600' },
  emerald: { label: 'Emerald & Teal', class: 'from-emerald-500 to-teal-600' },
  amber: { label: 'Amber & Bronze', class: 'from-amber-500 to-orange-600' },
  rose: { label: 'Rose & Crimson', class: 'from-rose-500 to-red-600' },
  sky: { label: 'Electric Sky', class: 'from-sky-500 to-blue-600' },
};

export const THEME_OPTIONS: Array<{ id: AppTheme; label: string; desc: string; icon: string }> = [
  { id: 'matrix', label: 'Matrix Neon', desc: 'Electric green on obsidian black (Default)', icon: '⚡' },
  { id: 'cyber-amber', label: 'Cyber Amber', desc: 'Phosphor VT220 amber on onyx', icon: '📟' },
  { id: 'tokyo-night', label: 'Tokyo Night', desc: 'Indigo midnight with vivid cyan & violet', icon: '🗼' },
  { id: 'catppuccin', label: 'Catppuccin Mocha', desc: 'Soothing dark pastel & lavender', icon: '☕' },
  { id: 'monokai', label: 'Monokai Pro', desc: 'Rich charcoal, vibrant yellow & lime', icon: '🎨' },
  { id: 'solarized-dark', label: 'Solarized Dark', desc: 'Deep marine teal & amber contrast', icon: '🌊' },
  { id: 'high-contrast-dark', label: 'High Contrast Dark', desc: 'Ultra-crisp pure dark & azure', icon: '🌙' },
  { id: 'dark', label: 'GitHub Dark', desc: 'Dimmed charcoal gray', icon: '🌑' },
  { id: 'midnight', label: 'Midnight OLED', desc: 'True pure 0x000 black & electric sky', icon: '🌌' },
  { id: 'dracula', label: 'Dracula', desc: 'Iconic purple & cyan vampire palette', icon: '🧛' },
  { id: 'nord', label: 'Nord Frost', desc: 'Arctic cold blues & frost slate', icon: '❄️' },
  { id: 'synthwave', label: 'Synthwave 84', desc: 'Cyberpunk neon pink & cyan glow', icon: '🌆' },
  { id: 'high-contrast-light', label: 'High Contrast Light', desc: 'Crisp high-contrast daylight', icon: '☀️' },
  { id: 'sepia', label: 'Warm Sepia', desc: 'Warm parchment paper & book tone', icon: '📜' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  currentTheme,
  onChangeTheme,
}) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentGradient = AVATAR_COLOR_GRADIENTS[formData.avatarColor]?.class || AVATAR_COLOR_GRADIENTS.indigo.class;

  const handleNameChange = (name: string) => {
    const words = name.trim().split(/\s+/);
    let initials = 'OP';
    if (words.length >= 2) {
      initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length > 0) {
      initials = words[0].slice(0, 2).toUpperCase();
    }
    setFormData(prev => ({ ...prev, name, initials: prev.initials || initials }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const updated = await api.saveUserProfile({
        ...formData,
        theme: currentTheme,
      });
      onUpdateProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      alert(`Failed to save profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-hub-surface border border-hub-border rounded-xl shadow-2xl max-w-2xl w-full z-10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hub-border flex items-center justify-between bg-hub-surface">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-hub-accent to-purple-600 flex items-center justify-center shadow">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-hub-text leading-tight">
                Profile & Theme Customization
              </h2>
              <p className="text-xs text-hub-muted leading-none mt-0.5">
                Saved permanently in SQLite & synchronized across local network
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-hub-muted hover:text-hub-text hover:bg-hub-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Top Live Preview Banner */}
          <div className="p-4 rounded-xl border border-hub-border bg-hub-bg flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentGradient} text-white font-bold text-xl flex items-center justify-center shadow-lg ring-2 ring-hub-border shrink-0`}>
              {formData.initials || 'OP'}
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-hub-text truncate">
                  {formData.name || 'Forge Operator'}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-hub-accent/15 text-hub-accent border border-hub-accent/30 font-semibold shrink-0">
                  @{formData.username || 'operator'}
                </span>
              </div>
              <p className="text-xs text-hub-muted truncate font-mono">
                {formData.email || 'operator@sourcehub.local'}
              </p>
              <p className="text-[11px] text-hub-muted italic truncate">
                "{formData.bio || 'Single-Operator Solo Forge Developer'}"
              </p>
            </div>
          </div>

          {/* Form Fields: Name, Username, Email, Bio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-hub-text flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-hub-accent" />
                <span>Display Name</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Forge Operator"
                required
                className="w-full px-3 py-2 bg-hub-bg border border-hub-border rounded-md text-xs text-hub-text font-medium focus:outline-none focus:border-hub-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-hub-text flex items-center space-x-1.5">
                <AtSign className="w-3.5 h-3.5 text-hub-accent" />
                <span>Username / Handle</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="operator"
                required
                className="w-full px-3 py-2 bg-hub-bg border border-hub-border rounded-md text-xs text-hub-text font-mono focus:outline-none focus:border-hub-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-hub-text flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-hub-accent" />
                <span>Git Author Email</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="operator@sourcehub.local"
                required
                className="w-full px-3 py-2 bg-hub-bg border border-hub-border rounded-md text-xs text-hub-text font-mono focus:outline-none focus:border-hub-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-hub-text flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-hub-accent" />
                <span>Avatar Initials</span>
              </label>
              <input
                type="text"
                maxLength={3}
                value={formData.initials}
                onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                placeholder="OP"
                className="w-full px-3 py-2 bg-hub-bg border border-hub-border rounded-md text-xs text-hub-text font-bold font-mono focus:outline-none focus:border-hub-accent"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-semibold text-hub-text">Bio / Forge Tagline</label>
              <input
                type="text"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Single-Operator Solo Forge Developer"
                className="w-full px-3 py-2 bg-hub-bg border border-hub-border rounded-md text-xs text-hub-text focus:outline-none focus:border-hub-accent"
              />
            </div>
          </div>

          {/* Avatar Color Swatches */}
          <div className="space-y-2 pt-2 border-t border-hub-border">
            <label className="text-xs font-bold text-hub-muted uppercase tracking-wider flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-hub-accent" />
              <span>Avatar Accent Gradient</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(AVATAR_COLOR_GRADIENTS).map(([key, config]) => {
                const isSelected = formData.avatarColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, avatarColor: key })}
                    className={`flex flex-col items-center p-2 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'border-hub-accent bg-hub-subtle ring-2 ring-hub-accent'
                        : 'border-hub-border bg-hub-bg hover:bg-hub-subtle/60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.class} flex items-center justify-center text-white mb-1 shadow-sm`}>
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>
                    <span className="text-[10px] text-hub-muted font-medium truncate w-full text-center">
                      {key}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Palette Selection */}
          <div className="space-y-2 pt-2 border-t border-hub-border">
            <label className="text-xs font-bold text-hub-muted uppercase tracking-wider flex items-center space-x-1.5">
              <Contrast className="w-3.5 h-3.5 text-hub-accent" />
              <span>Color Theme ({THEME_OPTIONS.length} Presets)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {THEME_OPTIONS.map((themeOption) => {
                const isSelected = currentTheme === themeOption.id;
                return (
                  <button
                    key={themeOption.id}
                    type="button"
                    onClick={() => {
                      onChangeTheme(themeOption.id);
                      setFormData(prev => ({ ...prev, theme: themeOption.id }));
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-hub-accent bg-hub-accent/15 ring-2 ring-hub-accent text-hub-text'
                        : 'border-hub-border bg-hub-bg hover:bg-hub-subtle text-hub-muted'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm">{themeOption.icon}</span>
                      <span className="font-semibold text-xs text-hub-text truncate">
                        {themeOption.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-hub-muted mt-1 leading-snug line-clamp-1">
                      {themeOption.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-hub-border flex items-center justify-between">
            <div className="text-xs text-hub-muted flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-hub-success-text" />
              <span>Changes persist to SQLite settings</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-hub-border bg-hub-subtle hover:bg-hub-border text-hub-text text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-md bg-hub-accent hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
