import React, { useState } from 'react';
import {
  Users,
  Package,
  MapPin,
  Flag,
  Share2,
  GitMerge,
  Split,
  Plus,
  Search,
  CheckCircle,
  FileText,
  Activity,
  Edit2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  StoryProject,
  ActorEntity,
  ObjectEntity,
  LocationEntity,
  FactionEntity,
  MentionRecord,
} from '../types';

interface RelationalGraphProps {
  project: StoryProject;
  onUpdateEntity: (category: 'actors' | 'objects' | 'locations' | 'factions', updatedList: any[]) => void;
  onAddMention: (mention: MentionRecord) => void;
  onMergeEntities: (primaryId: string, secondaryId: string, entityType: 'actor' | 'object') => void;
  onSplitEntity: (entityId: string, mentionIdsToMove: string[], newWorkingLabel: string) => void;
}

export const RelationalGraph: React.FC<RelationalGraphProps> = ({
  project,
  onUpdateEntity,
  onAddMention,
  onMergeEntities,
  onSplitEntity,
}) => {
  const [activeCategory, setActiveCategory] = useState<'actors' | 'objects' | 'locations' | 'factions' | 'mentions'>('actors');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(project.actors[0]?.id || null);

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeSecondaryId, setMergeSecondaryId] = useState('');

  // Split modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitEntityId, setSplitEntityId] = useState('');
  const [splitSelectedMentions, setSplitSelectedMentions] = useState<string[]>([]);
  const [splitNewLabel, setSplitNewLabel] = useState('');

  // Quick edit modal
  const [editingActor, setEditingActor] = useState<ActorEntity | null>(null);

  const categories = [
    { id: 'actors', label: 'Actors', icon: Users, count: project.actors.length },
    { id: 'objects', label: 'Objects & Relics', icon: Package, count: project.objects.length },
    { id: 'locations', label: 'Locations', icon: MapPin, count: project.locations.length },
    { id: 'factions', label: 'Factions', icon: Flag, count: project.factions.length },
    { id: 'mentions', label: 'Mention Trail', icon: FileText, count: project.mentions.length },
  ];

  // Filtered lists
  const filteredActors = project.actors.filter(
    (a) =>
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.identity.working_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.identity.name && a.identity.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredObjects = project.objects.filter(
    (o) =>
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.identity.working_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.identity.name && o.identity.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredLocations = project.locations.filter(
    (l) =>
      l.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.identity.working_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.identity.name && l.identity.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredMentions = project.mentions.filter(
    (m) =>
      m.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.passage_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Selected Entity Details
  const activeActor = project.actors.find((a) => a.id === selectedEntityId);
  const activeObject = project.objects.find((o) => o.id === selectedEntityId);
  const activeLocation = project.locations.find((l) => l.id === selectedEntityId);

  const entityMentions = project.mentions.filter((m) => m.entity_id === selectedEntityId);

  const handleExecuteMerge = () => {
    if (!mergePrimaryId || !mergeSecondaryId || mergePrimaryId === mergeSecondaryId) return;
    const isActor = project.actors.some((a) => a.id === mergePrimaryId);
    onMergeEntities(mergePrimaryId, mergeSecondaryId, isActor ? 'actor' : 'object');
    setShowMergeModal(false);
    setMergePrimaryId('');
    setMergeSecondaryId('');
  };

  const handleExecuteSplit = () => {
    if (!splitEntityId || splitSelectedMentions.length === 0 || !splitNewLabel) return;
    onSplitEntity(splitEntityId, splitSelectedMentions, splitNewLabel);
    setShowSplitModal(false);
    setSplitEntityId('');
    setSplitSelectedMentions([]);
    setSplitNewLabel('');
  };

  const handleSaveActorEdits = () => {
    if (!editingActor) return;
    const updated = project.actors.map((a) => (a.id === editingActor.id ? editingActor : a));
    onUpdateEntity('actors', updated);
    setEditingActor(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Top Banner & Folio Explainer */}
      <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-[#736B63] block font-bold mb-1">
            Archival Registry
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif italic text-[#1A1A1A] font-light flex items-center gap-2">
            <Share2 className="h-6 w-6 text-[#1A1A1A]" />
            <span>Relational Story Graph & Neutral Registry</span>
          </h2>
          <p className="text-xs text-[#5A554E] font-serif italic mt-1 max-w-2xl">
            Stable internal identifiers (<code className="text-[#1A1A1A] font-mono font-bold bg-[#E5E2D9] px-1.5 py-0.5 rounded">actor_001</code>,{' '}
            <code className="text-[#1A1A1A] font-mono font-bold bg-[#E5E2D9] px-1.5 py-0.5 rounded">object_001</code>) decouple story identities from changing surface names.
            Evidence and confidence accumulate progressively from accepted prose beats.
          </p>
        </div>

        {/* Action Tools: Merge & Split */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMergeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#E5E2D9] hover:bg-[#D8D4C7] text-xs font-sans uppercase tracking-wider font-bold text-[#1A1A1A] border border-[#1A1A1A]/30 transition shadow-sm"
          >
            <GitMerge className="h-3.5 w-3.5 text-[#1A1A1A]" />
            <span>Merge Identities</span>
          </button>

          <button
            onClick={() => {
              if (selectedEntityId) {
                setSplitEntityId(selectedEntityId);
                setShowSplitModal(true);
              }
            }}
            disabled={!selectedEntityId || entityMentions.length < 2}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#FAF8F2] hover:bg-[#E5E2D9] text-xs font-sans uppercase tracking-wider font-bold text-[#1A1A1A] border border-[#1A1A1A]/30 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Split className="h-3.5 w-3.5 text-[#1A1A1A]" />
            <span>Split Entity</span>
          </button>
        </div>
      </div>

      {/* Main Graph Grid: Left Navigation (4 cols) & Right Entity Inspector (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Category Selector & Entity List */}
        <div className="lg:col-span-4 space-y-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 bg-[#FAF8F2] p-1.5 rounded border border-[#1A1A1A]/30">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id as any);
                    if (cat.id === 'actors' && project.actors[0]) setSelectedEntityId(project.actors[0].id);
                    if (cat.id === 'objects' && project.objects[0]) setSelectedEntityId(project.objects[0].id);
                    if (cat.id === 'locations' && project.locations[0]) setSelectedEntityId(project.locations[0].id);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-[11px] font-sans uppercase tracking-wider font-bold transition ${
                    activeCategory === cat.id
                      ? 'bg-[#1A1A1A] text-[#FDFCF8] shadow-sm'
                      : 'text-[#736B63] hover:text-[#1A1A1A] hover:bg-[#E5E2D9]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                  <span className="text-[9px] opacity-75">({cat.count})</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-[#736B63]" />
            <input
              type="text"
              placeholder={`Search ${activeCategory}...`}
              className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded pl-9 pr-3 py-2 text-xs text-[#1A1A1A] placeholder-[#8C827A] focus:outline-none focus:border-[#1A1A1A]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Entity Items List */}
          <div className="bg-[#FAF8F2] border border-[#1A1A1A]/20 rounded p-2 max-h-[520px] overflow-y-auto space-y-1.5">
            {activeCategory === 'actors' &&
              filteredActors.map((actor) => (
                <button
                  key={actor.id}
                  onClick={() => setSelectedEntityId(actor.id)}
                  className={`w-full text-left p-3 rounded border transition flex items-center justify-between ${
                    selectedEntityId === actor.id
                      ? 'bg-[#1A1A1A] text-[#FDFCF8] border-[#1A1A1A] shadow-sm'
                      : 'bg-[#FDFCF8] border-[#1A1A1A]/15 text-[#1A1A1A] hover:bg-[#E5E2D9]/60'
                  }`}
                >
                  <div>
                    <div className={`text-[10px] font-bold font-mono ${selectedEntityId === actor.id ? 'text-[#E5E2D9]' : 'text-[#736B63]'}`}>{actor.id}</div>
                    <div className="text-sm font-serif font-bold">
                      {actor.identity.name || actor.identity.working_label}
                    </div>
                    <div className={`text-[10px] font-sans uppercase tracking-wider mt-0.5 ${selectedEntityId === actor.id ? 'text-white/70' : 'text-[#736B63]'}`}>
                      Role: {actor.roles.story.join(', ')}
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 ${selectedEntityId === actor.id ? 'text-white' : 'text-[#736B63]'}`} />
                </button>
              ))}

            {activeCategory === 'objects' &&
              filteredObjects.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => setSelectedEntityId(obj.id)}
                  className={`w-full text-left p-3 rounded border transition flex items-center justify-between ${
                    selectedEntityId === obj.id
                      ? 'bg-[#1A1A1A] text-[#FDFCF8] border-[#1A1A1A] shadow-sm'
                      : 'bg-[#FDFCF8] border-[#1A1A1A]/15 text-[#1A1A1A] hover:bg-[#E5E2D9]/60'
                  }`}
                >
                  <div>
                    <div className={`text-[10px] font-bold font-mono ${selectedEntityId === obj.id ? 'text-[#E5E2D9]' : 'text-[#736B63]'}`}>{obj.id}</div>
                    <div className="text-sm font-serif font-bold">
                      {obj.identity.name || obj.identity.working_label}
                    </div>
                    <div className={`text-[10px] font-sans uppercase tracking-wider mt-0.5 ${selectedEntityId === obj.id ? 'text-white/70' : 'text-[#736B63]'}`}>Status: {obj.status}</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 ${selectedEntityId === obj.id ? 'text-white' : 'text-[#736B63]'}`} />
                </button>
              ))}

            {activeCategory === 'locations' &&
              filteredLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedEntityId(loc.id)}
                  className={`w-full text-left p-3 rounded border transition flex items-center justify-between ${
                    selectedEntityId === loc.id
                      ? 'bg-[#1A1A1A] text-[#FDFCF8] border-[#1A1A1A] shadow-sm'
                      : 'bg-[#FDFCF8] border-[#1A1A1A]/15 text-[#1A1A1A] hover:bg-[#E5E2D9]/60'
                  }`}
                >
                  <div>
                    <div className={`text-[10px] font-bold font-mono ${selectedEntityId === loc.id ? 'text-[#E5E2D9]' : 'text-[#736B63]'}`}>{loc.id}</div>
                    <div className="text-sm font-serif font-bold">
                      {loc.identity.name || loc.identity.working_label}
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 ${selectedEntityId === loc.id ? 'text-white' : 'text-[#736B63]'}`} />
                </button>
              ))}

            {activeCategory === 'mentions' &&
              filteredMentions.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded bg-[#FDFCF8] border border-[#1A1A1A]/15 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] font-sans uppercase tracking-wider font-bold">
                    <span className="text-[#1A1A1A]">{m.entity_id}</span>
                    <span className="text-[#736B63]">{m.timestamp_label}</span>
                  </div>
                  <p className="text-[#1A1A1A] font-serif italic text-xs">"{m.passage_text}"</p>
                  <div className="text-[#2D5A27] text-[10px] font-sans font-bold uppercase">Confidence: {(m.confidence * 100).toFixed(0)}%</div>
                </div>
              ))}
          </div>
        </div>

        {/* Right: Detailed Entity Inspector & Mention Trail (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeActor && (
            <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 space-y-6 shadow-sm">
              <div className="flex items-start justify-between border-b border-[#1A1A1A]/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#1A1A1A] text-[#FDFCF8] font-mono text-xs font-bold">
                      {activeActor.id}
                    </span>
                    <h3 className="text-2xl font-bold text-[#1A1A1A] font-serif italic">
                      {activeActor.identity.name || 'Unnamed (Working Label Only)'}
                    </h3>
                  </div>
                  <p className="text-xs text-[#5A554E] font-serif italic mt-1">
                    Working Label: "{activeActor.identity.working_label}"
                  </p>
                </div>
                <button
                  onClick={() => setEditingActor(activeActor)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#E5E2D9] hover:bg-[#D8D4C7] text-xs font-sans uppercase tracking-wider font-bold text-[#1A1A1A] border border-[#1A1A1A]/20"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit Identity</span>
                </button>
              </div>

              {/* Roles & Current Dynamic State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Story & Scene Roles */}
                <div className="bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-4 space-y-2">
                  <span className="text-[10px] font-bold text-[#736B63] font-sans uppercase tracking-wider">
                    Narrative Roles (Mutable):
                  </span>
                  <div className="space-y-1.5 text-xs font-serif">
                    <div>
                      <span className="text-[#736B63] font-sans text-[10px] uppercase">Story Role:</span>{' '}
                      <span className="text-[#1A1A1A] font-bold">{activeActor.roles.story.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[#736B63] font-sans text-[10px] uppercase">Scene Role:</span>{' '}
                      <span className="text-[#1A1A1A]">{activeActor.roles.scene.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Immediate Psychological State */}
                <div className="bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-4 space-y-2">
                  <span className="text-[10px] font-bold text-[#736B63] font-sans uppercase tracking-wider">
                    Current Condition ($T$ State):
                  </span>
                  <div className="space-y-1.5 text-xs font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-[#736B63]">Fatigue:</span>
                      <span className="font-bold text-[#1A1A1A]">{(activeActor.current_state.fatigue * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#736B63]">Fear:</span>
                      <span className="font-bold text-[#1A1A1A]">{(activeActor.current_state.fear * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-[#736B63]">Emotion:</span>{' '}
                      <span className="text-[#1A1A1A] font-serif italic font-semibold">{activeActor.current_state.emotion}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Inventory / Possessions */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#736B63] font-sans uppercase tracking-wider">Possessions (Physical Links):</span>
                <div className="flex flex-wrap gap-2">
                  {activeActor.possessions.length === 0 ? (
                    <span className="text-xs text-[#736B63] font-serif italic">No held objects recorded in current beat.</span>
                  ) : (
                    activeActor.possessions.map((objId) => {
                      const obj = project.objects.find((o) => o.id === objId);
                      return (
                        <span
                          key={objId}
                          className="px-3 py-1 rounded bg-[#E5E2D9] border border-[#1A1A1A]/20 text-xs text-[#1A1A1A] font-serif flex items-center gap-1.5"
                        >
                          <Package className="h-3 w-3 text-[#1A1A1A]" />
                          <span>{obj?.identity.name || obj?.identity.working_label || objId}</span>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Mention History & Evidence Citations */}
              <div className="space-y-3 pt-3 border-t border-[#1A1A1A]/15">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#1A1A1A] font-sans uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#1A1A1A]" />
                    <span>Evidence & Mention Trail ({entityMentions.length} occurrences):</span>
                  </span>
                  <span className="text-[10px] text-[#736B63] font-sans uppercase tracking-wider font-bold">Traceable Provenance</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {entityMentions.length === 0 ? (
                    <div className="p-5 text-center text-xs text-[#736B63] border border-dashed border-[#1A1A1A]/20 rounded font-serif italic">
                      No explicit mentions recorded in manuscript yet.
                    </div>
                  ) : (
                    entityMentions.map((m) => (
                      <div
                        key={m.id}
                        className="p-3.5 rounded bg-[#FDFCF8] border border-[#1A1A1A]/20 text-xs space-y-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between text-[10px] font-sans uppercase tracking-wider font-bold">
                          <span className="text-[#1A1A1A]">{m.timestamp_label}</span>
                          <span className="text-[#2D5A27]">Confidence: {(m.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[#1A1A1A] font-serif italic text-sm">"{m.passage_text}"</p>
                        {m.evidence_notes.length > 0 && (
                          <div className="text-[10px] text-[#736B63] font-sans">
                            Evidence: {m.evidence_notes.join('; ')}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeObject && (
            <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 space-y-6 shadow-sm">
              <div className="flex items-start justify-between border-b border-[#1A1A1A]/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#1A1A1A] text-[#FDFCF8] font-mono text-xs font-bold">
                      {activeObject.id}
                    </span>
                    <h3 className="text-2xl font-bold text-[#1A1A1A] font-serif italic">
                      {activeObject.identity.name || activeObject.identity.working_label}
                    </h3>
                  </div>
                  <p className="text-xs text-[#5A554E] font-serif italic mt-1">
                    Working Label: "{activeObject.identity.working_label}"
                  </p>
                </div>
                <span
                  className={`text-[10px] font-sans uppercase tracking-wider font-bold px-2.5 py-1 rounded ${
                    activeObject.status === 'missing'
                      ? 'bg-[#966F33] text-[#FDFCF8]'
                      : activeObject.status === 'destroyed'
                      ? 'bg-[#8B263E] text-[#FDFCF8]'
                      : 'bg-[#2D5A27] text-[#FDFCF8]'
                  }`}
                >
                  Status: {activeObject.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-4 space-y-1 text-xs font-sans">
                  <span className="text-[#736B63] uppercase font-bold text-[10px] tracking-wider">Holder / Possessor:</span>
                  <div className="text-[#1A1A1A]">
                    {activeObject.current_holder_id ? (
                      <span className="font-serif italic font-bold">{activeObject.current_holder_id}</span>
                    ) : (
                      <span className="text-[#736B63] italic font-serif">None (Unclaimed / In Scene)</span>
                    )}
                  </div>
                </div>

                <div className="bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-4 space-y-1 text-xs font-sans">
                  <span className="text-[#736B63] uppercase font-bold text-[10px] tracking-wider">Narrative Salience:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-[#E5E2D9] rounded-full h-2">
                      <div
                        className="bg-[#1A1A1A] h-2 rounded-full"
                        style={{ width: `${activeObject.salience * 100}%` }}
                      />
                    </div>
                    <span className="text-[#1A1A1A] font-bold">{(activeObject.salience * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Object Mentions */}
              <div className="space-y-3 pt-3 border-t border-[#1A1A1A]/15">
                <span className="text-[10px] font-bold text-[#1A1A1A] font-sans uppercase tracking-wider">
                  Mention Trail ({entityMentions.length}):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {entityMentions.map((m) => (
                    <div key={m.id} className="p-3.5 rounded bg-[#FDFCF8] border border-[#1A1A1A]/20 text-xs space-y-1 shadow-sm">
                      <div className="flex justify-between text-[10px] font-sans uppercase tracking-wider font-bold text-[#736B63]">
                        <span>{m.timestamp_label}</span>
                        <span className="text-[#2D5A27]">Confidence: {(m.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-[#1A1A1A] italic font-serif text-sm">"{m.passage_text}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#1A1A1A] font-serif italic text-lg font-bold">
              <GitMerge className="h-5 w-5 text-[#1A1A1A]" />
              <span>Merge Working Entities</span>
            </div>
            <p className="text-xs text-[#5A554E] font-serif leading-relaxed">
              When subsequent story evidence reveals that two separate working entities are actually the same entity,
              merge them while retaining all historical mentions.
            </p>

            <div className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">Primary Entity (Target ID to Keep):</label>
                <select
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-2 text-[#1A1A1A] font-serif"
                  value={mergePrimaryId}
                  onChange={(e) => setMergePrimaryId(e.target.value)}
                >
                  <option value="">Select primary entity...</option>
                  {project.actors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}: {a.identity.name || a.identity.working_label}
                    </option>
                  ))}
                  {project.objects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}: {o.identity.name || o.identity.working_label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">Secondary Entity (To Merge into Primary):</label>
                <select
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-2 text-[#1A1A1A] font-serif"
                  value={mergeSecondaryId}
                  onChange={(e) => setMergeSecondaryId(e.target.value)}
                >
                  <option value="">Select secondary entity...</option>
                  {project.actors
                    .filter((a) => a.id !== mergePrimaryId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id}: {a.identity.name || a.identity.working_label}
                      </option>
                    ))}
                  {project.objects
                    .filter((o) => o.id !== mergePrimaryId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}: {o.identity.name || o.identity.working_label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#1A1A1A]/15">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-3 py-1.5 rounded bg-[#E5E2D9] text-xs font-sans uppercase tracking-wider font-bold text-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMerge}
                disabled={!mergePrimaryId || !mergeSecondaryId}
                className="px-4 py-1.5 rounded bg-[#1A1A1A] hover:bg-[#333333] text-xs font-sans uppercase tracking-wider font-bold text-[#FDFCF8] disabled:opacity-50"
              >
                Execute Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#1A1A1A] font-serif italic text-lg font-bold">
              <Split className="h-5 w-5" />
              <span>Split Entity Hypothesis ({splitEntityId})</span>
            </div>
            <p className="text-xs text-[#5A554E] font-serif leading-relaxed">
              When new evidence reveals that early mentions actually referred to two distinct entities, split the selected
              mentions into a newly created neutral entity.
            </p>

            <div className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">New Entity Working Label:</label>
                <input
                  type="text"
                  placeholder="e.g. the second iron key"
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-2 text-[#1A1A1A] font-serif"
                  value={splitNewLabel}
                  onChange={(e) => setSplitNewLabel(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">Select Mentions to Migrate:</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-[#FDFCF8] rounded border border-[#1A1A1A]/20">
                  {entityMentions.map((m) => (
                    <label key={m.id} className="flex items-start gap-2 text-xs text-[#1A1A1A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={splitSelectedMentions.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSplitSelectedMentions([...splitSelectedMentions, m.id]);
                          } else {
                            setSplitSelectedMentions(splitSelectedMentions.filter((id) => id !== m.id));
                          }
                        }}
                        className="mt-0.5 rounded border-[#1A1A1A]"
                      />
                      <span className="font-serif italic text-xs">"{m.passage_text}"</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#1A1A1A]/15">
              <button
                onClick={() => setShowSplitModal(false)}
                className="px-3 py-1.5 rounded bg-[#E5E2D9] text-xs font-sans uppercase tracking-wider font-bold text-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteSplit}
                disabled={!splitNewLabel || splitSelectedMentions.length === 0}
                className="px-4 py-1.5 rounded bg-[#1A1A1A] hover:bg-[#333333] text-xs font-sans uppercase tracking-wider font-bold text-[#FDFCF8] disabled:opacity-50"
              >
                Execute Split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Actor Modal */}
      {editingActor && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-serif italic font-bold text-[#1A1A1A]">Edit Actor Identity ({editingActor.id})</h3>
            <div className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">Human Project Name (Can be null):</label>
                <input
                  type="text"
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-2 text-[#1A1A1A] font-serif"
                  value={editingActor.identity.name || ''}
                  onChange={(e) =>
                    setEditingActor({
                      ...editingActor,
                      identity: { ...editingActor.identity, name: e.target.value || null },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">Working Label:</label>
                <input
                  type="text"
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-2 text-[#1A1A1A] font-serif"
                  value={editingActor.identity.working_label}
                  onChange={(e) =>
                    setEditingActor({
                      ...editingActor,
                      identity: { ...editingActor.identity, working_label: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-[#736B63] uppercase tracking-wider text-[10px] font-bold block mb-1">Story Role (Comma separated):</label>
                <input
                  type="text"
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-2 text-[#1A1A1A] font-serif"
                  value={editingActor.roles.story.join(', ')}
                  onChange={(e) =>
                    setEditingActor({
                      ...editingActor,
                      roles: { ...editingActor.roles, story: e.target.value.split(',').map((s) => s.trim()) },
                    })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[#1A1A1A]/15">
              <button
                onClick={() => setEditingActor(null)}
                className="px-3 py-1.5 rounded bg-[#E5E2D9] text-xs font-sans uppercase tracking-wider font-bold text-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveActorEdits}
                className="px-4 py-1.5 rounded bg-[#1A1A1A] hover:bg-[#333333] text-xs font-sans uppercase tracking-wider font-bold text-[#FDFCF8]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
