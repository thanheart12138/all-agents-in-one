interface CommandIconProps {
  commandName: string
}

export function CommandIcon({ commandName }: CommandIconProps): React.JSX.Element {
  const name = commandName.toLowerCase()

  if (name.includes('kimi')) {
    return <span className="command-icon kimi" title="Kimi">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 3.7a7.8 7.8 0 1 0 4.5 13.8A8.7 8.7 0 1 1 15.8 3.7Z" /><path d="m17.8 5.1.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" /></svg>
    </span>
  }

  if (name.includes('codex') || name.includes('openai') || name.includes('chatgpt')) {
    return <span className="command-icon codex" title="Codex">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.7" d="M12 3.2a4.1 4.1 0 0 1 4 3.1 4.1 4.1 0 0 1 2.7 6.8 4.1 4.1 0 0 1-4 5.7A4.1 4.1 0 0 1 8 17.7a4.1 4.1 0 0 1-2.7-6.8A4.1 4.1 0 0 1 9.3 5.2 4.1 4.1 0 0 1 12 3.2Z" /><path fill="none" stroke="currentColor" strokeWidth="1.7" d="m9.3 5.2 5.4 3.1v6.2L9.3 17.7m6.7-11.4-5.4 3.1v6.2l4.1 3.2m4-5.7-5.4-3.1-5.4 3.1v4.6m-2.6-6.8 5.3 3.1" /></svg>
    </span>
  }

  if (name.includes('claude')) {
    return <span className="command-icon claude" title="Claude">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2h2l-.3 7.1 3.3-6.3 1.7 1-3.8 5.9 5.9-3.8 1 1.7-6.3 3.3 7.1-.3v2l-7.1-.3 6.3 3.3-1 1.7-5.9-3.8 3.8 5.9-1.7 1-3.3-6.3.3 7.1h-2l.3-7.1-3.3 6.3-1.7-1 3.8-5.9-5.9 3.8-1-1.7 6.3-3.3-7.1.3v-2l7.1.3-6.3-3.3 1-1.7 5.9 3.8-3.8-5.9 1.7-1 3.3 6.3L11 2Z" /></svg>
    </span>
  }

  if (name.includes('grok')) {
    return <span className="command-icon grok" title="Grok">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18.7 5.3 7.2 16.8m10-9.9a7 7 0 1 0 .1 10.1M7.4 7.2h5.8v5.7" /></svg>
    </span>
  }

  if (name.includes('gemini')) {
    return <span className="command-icon gemini" title="Gemini">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.7 5.7 4.3 9.3 10 10-5.7.7-9.3 4.3-10 10-.7-5.7-4.3-9.3-10-10 5.7-.7 9.3-4.3 10-10Z" /></svg>
    </span>
  }

  return <span className="command-icon shell" title="Terminal">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m5 7 4.5 5L5 17m7 0h7" /></svg>
  </span>
}

