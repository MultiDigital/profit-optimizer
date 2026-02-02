'use client';

import { TrendingUp, UserPlus, Zap } from 'lucide-react';
import { OptimizationResult } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ProjectBreakdownProps {
  result: OptimizationResult;
}

export function ProjectBreakdown({ result }: ProjectBreakdownProps) {
  const { projectBreakdown } = result;

  if (projectBreakdown.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No profitable projects fit the capacity
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm text-muted-foreground mb-3">Optimal Project Mix (yearly)</h3>

      <div className="space-y-2">
        {projectBreakdown.map((project, index) => (
          <div
            key={index}
            className="flex justify-between items-start py-2 border-b border-white/10 last:border-b-0 text-sm"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{project.name}</span>
              <div className="flex gap-1.5">
                {project.isSubstitution && (
                  <Badge variant="secondary">
                    <Zap className="h-3 w-3 mr-1" />
                    substitution
                  </Badge>
                )}
                {project.isDemandCapped ? (
                  <Badge variant="secondary">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    sell more
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <UserPlus className="h-3 w-3 mr-1" />
                    hire staff
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-cyan-500 font-semibold">
                {project.count}x/yr → {formatCurrency(project.revenue)}
              </div>
              <div className="text-green-500 text-xs">
                margin {formatCurrency(project.margin)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
