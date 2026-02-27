/**
 * Model Selector Component
 *
 * A dynamic model selection component that fetches models from models.dev.
 * Supports searching, filtering by provider, and displaying model details.
 */

'use client';

import { useState, useEffect } from 'react';
import { useModelDirectory, type ModelDirectoryEntry } from '@/lib/hooks/useModelDirectory';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Sparkles, Cpu, DollarSign, MessageSquare, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string, provider: string) => void;
  provider?: string;
  suitableForSpecs?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ModelSelector({
  value,
  onChange,
  provider,
  suitableForSpecs = true,
  disabled = false,
  placeholder = 'Select a model...',
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(provider || null);
  
  const {
    models,
    providers,
    recommendedModels,
    loading,
    search,
    getModelById,
  } = useModelDirectory({
    providerId: selectedProvider || undefined,
    suitableForSpecs,
  });

  const selectedModel = getModelById(value);

  // Sync selectedProvider with provider prop when it changes
  useEffect(() => {
    setSelectedProvider(provider || null);
  }, [provider]);

  // Handle search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        search(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, search]);

  // Filter models based on search or provider
  const displayModels = searchQuery 
    ? models.filter(m => 
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : selectedProvider 
      ? models.filter(m => m.provider === selectedProvider)
      : recommendedModels.length > 0 
        ? recommendedModels 
        : models.slice(0, 20);

  const handleSelect = (model: ModelDirectoryEntry) => {
    onChange(model.id, model.provider);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selectedModel ? selectedModel.displayName : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Select AI Model
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Provider Filter - Scrollable */}
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground">Filter by Provider</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <Button
                variant={selectedProvider === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedProvider(null)}
                className="flex-shrink-0"
              >
                All Providers
              </Button>
              {providers.map((p) => (
                <Button
                  key={p.id}
                  variant={selectedProvider === p.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedProvider(p.id)}
                  className="flex-shrink-0"
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Models List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : displayModels.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No models found
              </div>
            ) : (
              displayModels.map((model) => (
                <button
                  key={`${model.provider}/${model.id}`}
                  onClick={() => handleSelect(model)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border transition-all hover:border-accent',
                    value === model.id 
                      ? 'border-accent bg-accent/5' 
                      : 'border-border bg-card'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.displayName}</span>
                        {value === model.id && (
                          <Badge variant="default" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Selected
                          </Badge>
                        )}
                        {model.capabilities.reasoning && (
                          <Badge variant="outline" className="text-xs">
                            Reasoning
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground mt-1">
                        {model.id}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Cpu className="w-3 h-3 mr-1 inline" />
                          {model.formattedLimits.context} context
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <MessageSquare className="w-3 h-3 mr-1 inline" />
                          {model.formattedLimits.output} output
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <DollarSign className="w-3 h-3 mr-1 inline" />
                          {model.formattedCost.input} → {model.formattedCost.output}
                        </Badge>
                      </div>

                      {model.capabilities.toolCall && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="outline" className="text-xs">Tool Calling</Badge>
                          {model.capabilities.structuredOutput && (
                            <Badge variant="outline" className="text-xs">Structured Output</Badge>
                          )}
                          {model.capabilities.attachments && (
                            <Badge variant="outline" className="text-xs">Attachments</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact version for inline use
interface CompactModelSelectorProps {
  value: string;
  onChange: (modelId: string, provider: string) => void;
  className?: string;
}

export function CompactModelSelector({ value, onChange, className }: CompactModelSelectorProps) {
  const { getModelById, recommendedModels } = useModelDirectory({ suitableForSpecs: true });
  const selectedModel = getModelById(value);

  return (
    <select
      value={value}
      onChange={(e) => {
        const modelId = e.target.value;
        const model = recommendedModels.find(m => m.id === modelId);
        if (model) {
          onChange(modelId, model.provider);
        }
      }}
      className={cn(
        'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm',
        'focus:outline-none focus:ring-2 focus:ring-accent',
        className
      )}
    >
      {recommendedModels.map((model) => (
        <option key={model.id} value={model.id}>
          {model.displayName} ({model.formattedLimits.context} ctx)
        </option>
      ))}
      {!recommendedModels.find(m => m.id === value) && selectedModel && (
        <option value={value}>{selectedModel.displayName}</option>
      )}
    </select>
  );
}
