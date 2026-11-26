/**
 * Painel de PGN: exportacao (textarea somente-leitura + copiar) e importacao
 * (textarea + botao, com erro em portugues quando o PGN e rejeitado).
 */
import { useState } from 'react';

import type { ImportPgnResult } from './useChessGame.js';

interface PgnPanelProps {
  exportPgn: () => string;
  importPgn: (pgn: string) => ImportPgnResult;
}

export function PgnPanel({ exportPgn, importPgn }: PgnPanelProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const pgn = exportPgn();

  async function handleCopy(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText !== undefined) {
        await navigator.clipboard.writeText(pgn);
        setCopyFeedback('Copiado!');
      } else {
        setCopyFeedback('Copia nao suportada neste navegador.');
      }
    } catch {
      setCopyFeedback('Nao foi possivel copiar.');
    } finally {
      setTimeout(() => {
        setCopyFeedback(null);
      }, 2000);
    }
  }

  function handleImport(): void {
    const result = importPgn(importText);
    if (result.ok) {
      setImportError(null);
      setImportText('');
    } else {
      setImportError(result.error);
    }
  }

  return (
    <div className="pgn-panel">
      <div className="pgn-section">
        <h3>Exportar PGN</h3>
        <textarea
          className="pgn-textarea"
          readOnly
          value={pgn}
          aria-label="PGN da partida"
        />
        <div className="pgn-actions">
          <button type="button" onClick={handleCopy}>
            Copiar PGN
          </button>
          {copyFeedback !== null ? (
            <span className="pgn-feedback">{copyFeedback}</span>
          ) : null}
        </div>
      </div>
      <div className="pgn-section">
        <h3>Importar PGN</h3>
        <textarea
          className="pgn-textarea"
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
          }}
          placeholder="Cole aqui um PGN para carregar a partida"
          aria-label="Colar PGN para importar"
        />
        <div className="pgn-actions">
          <button
            type="button"
            onClick={handleImport}
            disabled={importText.trim() === ''}
          >
            Importar PGN
          </button>
        </div>
        {importError !== null ? <p className="pgn-error">{importError}</p> : null}
      </div>
    </div>
  );
}
