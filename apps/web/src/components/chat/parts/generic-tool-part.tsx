import type { ReactElement } from 'react';

import type { ToolPartState } from './registry';
import { ToolCard } from './tool-card';

function toCardState(state: ToolPartState): 'input-streaming' | 'output-available' | 'output-error' {
  if (state === 'loading') return 'input-streaming';
  if (state === 'error') return 'output-error';
  return 'output-available';
}

export function GenericToolPart({
  output,
  state,
  errorMessage,
}: {
  output: unknown;
  state: ToolPartState;
  errorMessage?: string;
}): ReactElement {
  return (
    <ToolCard
      name="tool"
      state={toCardState(state)}
      input={undefined}
      output={output}
      {...(errorMessage !== undefined ? { errorText: errorMessage } : {})}
    />
  );
}
