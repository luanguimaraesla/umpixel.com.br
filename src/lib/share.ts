export async function sharePage(url: string, title: string): Promise<string> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return '';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return '';
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'Link copiado!';
  } catch {
    return `Não foi possível copiar. Compartilhe este link: ${url}`;
  }
}
