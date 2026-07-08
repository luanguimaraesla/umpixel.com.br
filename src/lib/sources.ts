export interface Source {
  nome: string;
  url: string;
}

// --- Source links, mounted from the fetched data ---
export function mountSources(
  target: HTMLElement,
  groups: { label: string; raw: { fontes: Source[]; acessado_em: string } | null }[],
): void {
  const frag = document.createDocumentFragment();
  for (const group of groups) {
    if (!group.raw) continue;
    const wrap = document.createElement('div');
    const head = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = group.label;
    head.append(strong, document.createTextNode(` · acesso em ${group.raw.acessado_em}`));
    const ul = document.createElement('ul');
    for (const source of group.raw.fontes) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = source.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = source.nome;
      li.appendChild(a);
      ul.appendChild(li);
    }
    wrap.append(head, ul);
    frag.appendChild(wrap);
  }
  target.replaceChildren(frag);
}
