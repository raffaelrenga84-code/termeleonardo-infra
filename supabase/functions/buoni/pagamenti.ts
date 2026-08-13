/* Quali pagamenti fanno nascere il buono già valido, col suo codice.
   'promozionale' è l'omaggio deciso in reception: non c'è incasso da
   attendere, quindi il buono è spendibile da subito. */
const SENZA_ATTESA = ['contanti', 'bancomat', 'pos', 'promozionale'];

export function nasceGiaPagato(pagamento: unknown): boolean {
  return SENZA_ATTESA.includes(String(pagamento ?? ''));
}
