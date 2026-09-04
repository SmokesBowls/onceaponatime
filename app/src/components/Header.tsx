import React from 'react';
import {
  BookOpen,
  Share2,
  Brain,
  Clock,
  FileText,
  FlaskConical,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
  PlusCircle,
  FolderOpen,
} from 'lucide-react';
import { StoryProject } from '../types';

interface HeaderProps {
  projects: StoryProject[];
  activeProject: StoryProject;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  undoCount: number;
  onUndo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onNewProject,
  activeTab,
  onSelectTab,
  undoCount,
  onUndo,
}) => {
  const tabs = [
    { id: 'workbench', label: 'Story Workbench', icon: BookOpen },
    { id: 'graph', label: 'Relational Graph', icon: Share2 },
    { id: 'knowledge', label: 'Knowledge & Reveals', icon: Brain },
    { id: 'timeline', label: 'Temporal State', icon: Clock },
    { id: 'codex', label: 'Accumulated Codex', icon: FileText },
    { id: 'benchmark', label: '10-Test Benchmark', icon: FlaskConical },
    { id: 'mechanics', label: 'Literary Mechanics', icon: HelpCircle },
  ];

  const povActor = activeProject.actors.find((a) => a.id === activeProject.activePovActorId);

  return (
    <header className="bg-[#FDFCF8] border-b border-[#1A1A1A] text-[#1A1A1A] sticky top-0 z-30">
      {/* Top Gazette Masthead */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-5 pb-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-baseline border-b border-[#1A1A1A]/20 pb-3 gap-2">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-sans font-bold text-[#5A554E] flex items-center gap-2">
            <span>Issue No. 04</span>
            <span className="opacity-40">—</span>
            <span>Literary Framework</span>
          </div>

          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-serif italic tracking-tighter text-[#1A1A1A] flex items-center justify-center gap-2">
              <span>Onceaponatime</span>
            </h1>
          </div>

          <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-sans font-bold text-[#5A554E] flex items-center gap-3">
            <span>The Narrative Archive</span>
            <div className="flex items-center gap-1 bg-[#E5E2D9] px-2 py-0.5 rounded text-[10px] text-[#1A1A1A]">
              <ShieldCheck className="h-3 w-3 text-[#2D5A27]" />
              <span>Boundaries On</span>
            </div>
          </div>
        </div>

        {/* Project Selector & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          {/* Left: Project Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans text-[10px] uppercase tracking-widest text-[#736B63] font-semibold">
              Project:
            </span>
            <div className="flex items-center bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded px-2.5 py-1 text-xs text-[#1A1A1A]">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5 text-[#1A1A1A]/70" />
              <select
                className="bg-transparent border-none text-xs text-[#1A1A1A] font-serif italic focus:outline-none cursor-pointer pr-3 font-semibold"
                value={activeProject.id}
                onChange={(e) => onSelectProject(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#FAF8F2] text-[#1A1A1A]">
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onNewProject}
              title="Create New Story Project"
              className="px-2.5 py-1 rounded bg-[#E5E2D9] hover:bg-[#D8D4C7] border border-[#1A1A1A]/20 text-[#1A1A1A] text-xs font-sans uppercase tracking-wider font-semibold transition flex items-center gap-1"
            >
              <PlusCircle className="h-3 w-3" />
              <span>New</span>
            </button>
          </div>

          {/* Right: Story State & Undo */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden lg:flex items-center gap-2 text-xs font-serif text-[#5A554E] bg-[#FAF8F2] border border-[#1A1A1A]/15 px-3 py-1 rounded">
              <span className="font-sans text-[10px] uppercase tracking-wider font-bold text-[#1A1A1A]">POV:</span>
              <span className="italic font-medium text-[#1A1A1A]">{povActor?.identity.name || povActor?.identity.working_label || 'Unassigned'}</span>
              <span className="opacity-30">|</span>
              <span>Beat #{activeProject.currentPosition.beat}</span>
              <span className="opacity-30">|</span>
              <span className="truncate max-w-[150px]">{activeProject.currentPosition.location_label}</span>
            </div>

            <button
              onClick={onUndo}
              disabled={undoCount === 0}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-sans uppercase tracking-wider font-bold border transition ${
                undoCount > 0
                  ? 'bg-[#1A1A1A] text-[#FDFCF8] border-[#1A1A1A] hover:bg-[#333333]'
                  : 'bg-[#FAF8F2] text-[#A09A90] border-[#1A1A1A]/10 cursor-not-allowed'
              }`}
              title="Rollback Last Accepted Story State"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Undo ({undoCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editorial Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 flex overflow-x-auto no-scrollbar border-t border-[#1A1A1A]/15">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 text-[11px] sm:text-xs font-sans uppercase tracking-[0.15em] font-bold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#1A1A1A] text-[#1A1A1A] bg-[#E5E2D9]/40'
                  : 'border-transparent text-[#736B63] hover:text-[#1A1A1A] hover:bg-[#F4F1EA]/60'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#1A1A1A]' : 'text-[#736B63]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

