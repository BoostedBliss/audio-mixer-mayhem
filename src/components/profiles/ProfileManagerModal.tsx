import React, { useState, useRef } from 'react';
import {
  X,
  Bookmark,
  Sparkles,
  Tv,
  Radio,
  Sliders,
  Video,
  Check,
  CheckCircle2,
  Trash2,
  Copy,
  Download,
  Upload,
  Layers,
  ArrowRight,
  Plus,
  Clock,
  RotateCcw,
  Volume2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import {
  RoutingProfile,
  VirtualDevice,
  ProfileCategory,
} from '../../types';
import {
  PRESET_ROUTING_TEMPLATES,
  createProfileFromDevice,
  applyProfileToDevice,
} from '../../data/routingTemplates';

interface ProfileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDevice: VirtualDevice;
  activeProfileId: string | null;
  savedProfiles: RoutingProfile[];
  onApplyProfile: (profile: RoutingProfile) => void;
  onSaveNewProfile: (profile: RoutingProfile) => void;
  onUpdateExistingProfile: (profile: RoutingProfile) => void;
  onDeleteProfile: (id: string) => void;
  onImportProfiles: (imported: RoutingProfile[]) => void;
}

export const ProfileManagerModal: React.FC<ProfileManagerModalProps> = ({
  isOpen,
  onClose,
  currentDevice,
  activeProfileId,
  savedProfiles,
  onApplyProfile,
  onSaveNewProfile,
  onUpdateExistingProfile,
  onDeleteProfile,
  onImportProfiles,
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'saved'>('templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New Profile Form State
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [newProfileCategory, setNewProfileCategory] = useState<ProfileCategory>('streaming');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => {
      setNotificationMsg(null);
    }, 2800);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    const newProfile = createProfileFromDevice(
      currentDevice,
      newProfileName.trim(),
      newProfileDesc.trim(),
      newProfileCategory
    );

    onSaveNewProfile(newProfile);
    setIsCreatingNew(false);
    setNewProfileName('');
    setNewProfileDesc('');
    setActiveTab('saved');
    showNotification(`Profile "${newProfile.name}" created and saved.`);
  };

  const handleApply = (profile: RoutingProfile) => {
    onApplyProfile(profile);
    showNotification(`Applied "${profile.name}" to ${currentDevice.name}`);
  };

  const handleOverwrite = (profile: RoutingProfile) => {
    const updated: RoutingProfile = {
      ...profile,
      updatedAt: Date.now(),
      sampleRate: currentDevice.sampleRate,
      bufferSize: currentDevice.bufferSize,
      channelCount: currentDevice.channelCount,
      sources: JSON.parse(JSON.stringify(currentDevice.sources)),
      destinations: JSON.parse(JSON.stringify(currentDevice.destinations)),
      routes: JSON.parse(JSON.stringify(currentDevice.routes)),
      channels: JSON.parse(JSON.stringify(currentDevice.channels)),
      masterVolumeDb: currentDevice.masterVolumeDb,
      masterMuted: currentDevice.masterMuted,
      monitorVolumeDb: currentDevice.monitorVolumeDb,
      monitorMuted: currentDevice.monitorMuted,
    };
    onUpdateExistingProfile(updated);
    showNotification(`Updated profile "${profile.name}" with current state.`);
  };

  const handleDuplicate = (profile: RoutingProfile) => {
    const duplicated: RoutingProfile = {
      ...JSON.parse(JSON.stringify(profile)),
      id: `profile-copy-${Date.now()}`,
      name: `${profile.name} (Copy)`,
      isTemplate: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSaveNewProfile(duplicated);
    showNotification(`Duplicated "${profile.name}".`);
  };

  const handleExportProfile = (profile: RoutingProfile) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_profile.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification(`Exported "${profile.name}" JSON`);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportProfiles(parsed);
          showNotification(`Imported ${parsed.length} profiles successfully.`);
        } else if (parsed && parsed.name && parsed.routes) {
          const importedProfile: RoutingProfile = {
            ...parsed,
            id: `imported-${Date.now()}`,
            isTemplate: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          onSaveNewProfile(importedProfile);
          showNotification(`Imported profile "${importedProfile.name}".`);
        } else {
          alert('Invalid profile JSON structure.');
        }
      } catch (err) {
        console.error('Import error', err);
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getCategoryIcon = (category: ProfileCategory) => {
    switch (category) {
      case 'streaming':
        return <Tv className="w-4 h-4 text-emerald-400" />;
      case 'podcasting':
        return <Radio className="w-4 h-4 text-amber-400" />;
      case 'music_production':
        return <Sliders className="w-4 h-4 text-purple-400" />;
      case 'broadcast':
        return <Video className="w-4 h-4 text-blue-400" />;
      default:
        return <Bookmark className="w-4 h-4 text-neutral-400" />;
    }
  };

  const filteredTemplates = PRESET_ROUTING_TEMPLATES.filter((t) => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#1C1C22] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#E0E0E0]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#16161A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white/90">
                  Audio Profiles & Routing Templates
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold">
                  CoreAudio Presets
                </span>
              </div>
              <p className="text-xs text-white/40">
                Instantly recall complete matrix routing paths, gain trim, HPF rumble cuts, and fader volume levels.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {notificationMsg && (
              <div className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{notificationMsg}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection & Actions Bar */}
        <div className="px-6 py-3 border-b border-white/5 bg-[#111114] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Main Tabs */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'templates'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Preset Audio Templates ({PRESET_ROUTING_TEMPLATES.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'saved'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>User Saved Profiles ({savedProfiles.length})</span>
            </button>
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreatingNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Current Setup as Profile</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 transition-colors"
              title="Import Profile JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Create New Profile Form (Collapsible) */}
          {isCreatingNew && (
            <div className="p-5 rounded-2xl bg-black/40 border border-blue-500/30 space-y-4 mb-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-bold text-white/90">
                    Save Active Routing & Fader Volumes as New Profile
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-white/40 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateProfile} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">
                      Profile Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Legends Stream Mix"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="w-full bg-[#16161A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">
                      Category
                    </label>
                    <select
                      value={newProfileCategory}
                      onChange={(e) => setNewProfileCategory(e.target.value as ProfileCategory)}
                      className="w-full bg-[#16161A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="streaming">Streaming Setup (OBS / Gaming)</option>
                      <option value="podcasting">Podcasting Setup (DAW / Calls)</option>
                      <option value="music_production">Music Production (Studio Monitors)</option>
                      <option value="broadcast">Broadcast / Video Meetings</option>
                      <option value="custom">Custom Audio Router</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">
                    Description & Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Balanced Spotify ducked at -6dB, mic +2dB with 80Hz rumble cut."
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    className="w-full bg-[#16161A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Current State Snapshot Summary */}
                <div className="p-3 bg-[#16161A] rounded-xl border border-white/5 flex flex-wrap items-center justify-between text-[11px] font-mono text-white/40">
                  <div>
                    Capturing: <span className="text-white/80">{currentDevice.sources.length} Sources</span>,{' '}
                    <span className="text-white/80">{currentDevice.destinations.length} Destinations</span>,{' '}
                    <span className="text-white/80">{currentDevice.routes.length} Active Cross-Points</span>,{' '}
                    <span className="text-white/80">{currentDevice.channelCount} Console Faders</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Master: {currentDevice.masterVolumeDb > 0 ? `+${currentDevice.masterVolumeDb}` : currentDevice.masterVolumeDb} dB</span>
                    <span>•</span>
                    <span>Monitor: {currentDevice.monitorVolumeDb > 0 ? `+${currentDevice.monitorVolumeDb}` : currentDevice.monitorVolumeDb} dB</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Profile</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 1: Preset Audio Templates */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'All Templates' },
                  { id: 'streaming', label: 'Streaming (OBS/Gaming)' },
                  { id: 'podcasting', label: 'Podcasting (DAW/Guests)' },
                  { id: 'music_production', label: 'Music Production (Monitors)' },
                  { id: 'broadcast', label: 'Conference Clean Feed' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => {
                  const isActive = activeProfileId === template.id;
                  return (
                    <div
                      key={template.id}
                      className={`bg-black/20 border rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden group ${
                        isActive
                          ? 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30'
                          : 'border-white/5 hover:border-white/15'
                      }`}
                    >
                      {/* Top bar with icon, title, badge */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              {getCategoryIcon(template.category)}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">
                                {template.name}
                              </h4>
                              <span className="text-[10px] font-mono text-blue-400">
                                {template.tag}
                              </span>
                            </div>
                          </div>

                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-white/50 leading-relaxed mb-4">
                          {template.description}
                        </p>

                        {/* Specs telemetry chips */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-[10px] font-mono">
                          <div className="bg-[#16161A] p-2 rounded-lg border border-white/5">
                            <span className="text-white/30 block uppercase">Hardware</span>
                            <span className="text-white/80 font-bold">
                              {template.bufferSize} smp @ {template.sampleRate / 1000}k
                            </span>
                          </div>
                          <div className="bg-[#16161A] p-2 rounded-lg border border-white/5">
                            <span className="text-white/30 block uppercase">Endpoints</span>
                            <span className="text-white/80 font-bold">
                              {template.sources.length} In • {template.destinations.length} Out
                            </span>
                          </div>
                          <div className="bg-[#16161A] p-2 rounded-lg border border-white/5">
                            <span className="text-white/30 block uppercase">Console</span>
                            <span className="text-white/80 font-bold">
                              {template.channelCount} Faders
                            </span>
                          </div>
                        </div>

                        {/* Routing Path Highlights */}
                        <div className="space-y-1.5 mb-4">
                          <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider block">
                            Key Signal Paths:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {template.sources.slice(0, 3).map((src, i) => (
                              <span
                                key={src.id}
                                className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] text-white/70"
                              >
                                {src.name}
                              </span>
                            ))}
                            <span className="px-2 py-0.5 text-[10px] text-white/40">
                              ➔ {template.destinations[0]?.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleDuplicate(template)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors flex items-center gap-1"
                          title="Save as a customizable copy in User Profiles"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Clone</span>
                        </button>

                        <button
                          onClick={() => handleApply(template)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isActive ? 'Re-Apply Preset' : 'Apply Template'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: User Saved Profiles */}
          {activeTab === 'saved' && (
            <div className="space-y-4">
              {savedProfiles.length === 0 ? (
                <div className="py-12 px-6 rounded-2xl bg-black/20 border border-white/5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white/80">No Saved User Profiles Yet</h4>
                  <p className="text-xs text-white/40 max-w-md mx-auto leading-relaxed">
                    Save your active audio routing paths, input gain levels, fader balance, and monitoring settings to switch seamlessly between different streaming, podcasting, or music production setups.
                  </p>
                  <button
                    onClick={() => setIsCreatingNew(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save Current Setup as First Profile</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedProfiles.map((profile) => {
                    const isActive = activeProfileId === profile.id;
                    const dateFormatted = new Date(profile.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={profile.id}
                        className={`p-4 rounded-2xl bg-black/20 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isActive
                            ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] ring-1 ring-blue-500/30'
                            : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        {/* Profile Details */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              {getCategoryIcon(profile.category)}
                            </div>
                            <h4 className="text-sm font-bold text-white/90">{profile.name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/50 uppercase">
                              {profile.category.replace('_', ' ')}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 leading-relaxed max-w-xl pl-9.5">
                            {profile.description || 'Custom loopback configuration snapshot.'}
                          </p>
                          <div className="flex items-center gap-4 text-[10px] font-mono text-white/40 pl-9.5 pt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{dateFormatted}</span>
                            </span>
                            <span>•</span>
                            <span>{profile.sources?.length || 0} Sources</span>
                            <span>•</span>
                            <span>{profile.destinations?.length || 0} Destinations</span>
                            <span>•</span>
                            <span>{profile.routes?.length || 0} Routes</span>
                            <span>•</span>
                            <span>{profile.channelCount} Channels</span>
                          </div>
                        </div>

                        {/* Profile Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => handleOverwrite(profile)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                            title="Overwrite this profile with current active routing & faders"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(profile)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                            title="Duplicate profile"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleExportProfile(profile)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                            title="Export Profile JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Delete saved profile "${profile.name}"?`)) {
                                onDeleteProfile(profile.id);
                                showNotification(`Deleted profile "${profile.name}".`);
                              }
                            }}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors"
                            title="Delete profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleApply(profile)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              isActive
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isActive ? 'Loaded' : 'Load Profile'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-[#16161A] flex items-center justify-between text-xs text-white/40">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Target Device: <strong className="text-white/80">{currentDevice.name}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
