'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useGenerationStore } from '@/stores/generation-store';
import type { GenerationType } from '@/types/generation';

interface GenerationSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS: Array<{ key: GenerationType; label: string }> = [
  { key: 'weekly_report', label: '주간보고' },
  { key: 'dooray', label: '두레이' },
];

export function GenerationSettings({ open, onOpenChange }: GenerationSettingsProps) {
  const {
    templates,
    bestPractices,
    fetchAll,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createBestPractice,
    updateBestPractice,
    deleteBestPractice,
  } = useGenerationStore();
  const [activeType, setActiveType] = useState<GenerationType>('weekly_report');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [newPracticeTitle, setNewPracticeTitle] = useState('');
  const [newPracticeContent, setNewPracticeContent] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingPracticeId, setEditingPracticeId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void fetchAll(activeType);
  }, [open, activeType, fetchAll]);

  useEffect(() => {
    if (!open) return;
    setEditingTemplateId(null);
    setEditingPracticeId(null);
    setNewTemplateName('');
    setNewTemplateContent('');
    setNewPracticeTitle('');
    setNewPracticeContent('');
  }, [open, activeType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>생성 템플릿 관리</DialogTitle>
          <DialogDescription>주간보고/두레이 템플릿과 Best Practice를 관리합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                type="button"
                size="xs"
                variant={activeType === tab.key ? 'default' : 'outline'}
                onClick={() => setActiveType(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="text-xs font-semibold text-foreground">템플릿</div>
              <div className="space-y-2">
                <Input
                  placeholder="템플릿 이름"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="bg-background border-border"
                />
                <Textarea
                  placeholder="템플릿 내용 (Markdown)"
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  className="min-h-28 bg-background border-border"
                />
                <Button
                  type="button"
                  size="xs"
                  onClick={async () => {
                    if (!newTemplateName.trim()) return;
                    if (editingTemplateId) {
                      await updateTemplate(editingTemplateId, {
                        name: newTemplateName.trim(),
                        content: newTemplateContent,
                      }, activeType);
                    } else {
                      await createTemplate({
                        type: activeType,
                        name: newTemplateName.trim(),
                        content: newTemplateContent,
                      });
                    }
                    setEditingTemplateId(null);
                    setNewTemplateName('');
                    setNewTemplateContent('');
                  }}
                >
                  {editingTemplateId ? '템플릿 수정' : '템플릿 추가'}
                </Button>
                {editingTemplateId && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setEditingTemplateId(null);
                      setNewTemplateName('');
                      setNewTemplateContent('');
                    }}
                  >
                    취소
                  </Button>
                )}
              </div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {templates[activeType].map((template) => (
                  <div key={template.id} className="flex items-center justify-between rounded border border-border/70 px-2 py-1">
                    <div className="min-w-0">
                      <div className="truncate text-xs text-foreground">{template.name}</div>
                      {template.is_default === 1 && <div className="text-[10px] text-primary">기본 템플릿</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingTemplateId(template.id);
                          setNewTemplateName(template.name);
                          setNewTemplateContent(template.content);
                        }}
                      >
                        수정
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={template.is_default === 1}
                        onClick={async () => {
                          await deleteTemplate(template.id, activeType);
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="text-xs font-semibold text-foreground">Best Practice</div>
              <div className="space-y-2">
                <Input
                  placeholder="제목"
                  value={newPracticeTitle}
                  onChange={(e) => setNewPracticeTitle(e.target.value)}
                  className="bg-background border-border"
                />
                <Textarea
                  placeholder="내용"
                  value={newPracticeContent}
                  onChange={(e) => setNewPracticeContent(e.target.value)}
                  className="min-h-28 bg-background border-border"
                />
                <Button
                  type="button"
                  size="xs"
                  onClick={async () => {
                    if (!newPracticeTitle.trim()) return;
                    if (editingPracticeId) {
                      await updateBestPractice(editingPracticeId, {
                        title: newPracticeTitle.trim(),
                        content: newPracticeContent,
                      }, activeType);
                    } else {
                      await createBestPractice({
                        type: activeType,
                        title: newPracticeTitle.trim(),
                        content: newPracticeContent,
                      });
                    }
                    setEditingPracticeId(null);
                    setNewPracticeTitle('');
                    setNewPracticeContent('');
                  }}
                >
                  {editingPracticeId ? 'Best Practice 수정' : 'Best Practice 추가'}
                </Button>
                {editingPracticeId && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setEditingPracticeId(null);
                      setNewPracticeTitle('');
                      setNewPracticeContent('');
                    }}
                  >
                    취소
                  </Button>
                )}
              </div>
              <div className="space-y-1 max-h-48 overflow-auto">
                {bestPractices[activeType].map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded border border-border/70 px-2 py-1">
                    <div className="min-w-0">
                      <div className="truncate text-xs text-foreground">{item.title}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingPracticeId(item.id);
                          setNewPracticeTitle(item.title);
                          setNewPracticeContent(item.content);
                        }}
                      >
                        수정
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={async () => {
                          await deleteBestPractice(item.id, activeType);
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
