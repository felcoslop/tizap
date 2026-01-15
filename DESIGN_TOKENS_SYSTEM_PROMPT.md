🔒 REGRAS OBRIGATÓRIAS FIXAS - NUNCA ALTERE:
Use EXATAMENTE estas CSS variables em TODO código:

## 🔲 SPACING (8pt Grid)
```css
--spacing-0: 0;
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-7: 1.75rem;  /* 28px */
--spacing-8: 2rem;     /* 32px */
--spacing-10: 2.5rem;  /* 40px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */
--spacing-20: 5rem;    /* 80px */
--spacing-24: 6rem;    /* 96px */
```

## 📝 TIPOGRAFIA
```css
--font-size-xs: 0.75rem;   /* 12px */
--font-size-sm: 0.875rem;  /* 14px */
--font-size-base: 1rem;    /* 16px */
--font-size-lg: 1.125rem;  /* 18px */
--font-size-xl: 1.25rem;   /* 20px */
--font-size-2xl: 1.5rem;   /* 24px */
--font-size-3xl: 1.875rem; /* 30px */
--font-size-4xl: 2.25rem;  /* 36px */
--font-size-5xl: 3rem;     /* 48px */
--font-size-6xl: 3.75rem;  /* 60px */

--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-black: 900;

--line-height-tight: 1.2;
--line-height-normal: 1.5;
--line-height-loose: 1.7;
```

## 🎨 CORES - ESTADOS & NEUTROS
```css
--color-bg-primary: #ffffff;
--color-bg-secondary: #f8fafc;
--color-text-primary: #0f172a;
--color-text-secondary: #475569;

--color-primary: #3b82f6;
--color-primary-hover: #2563eb;
--color-success: #10b981;
--color-error: #ef4444;
--color-warning: #f59e0b;
```

## 📥 INPUTS (Todos os estados)
```css
--input-bg: #ffffff;
--input-border: #d1d5db;
--input-border-focus: var(--color-primary);
--input-border-error: #ef4444;
--input-text-placeholder: #9ca3af;
```

## 🔘 BOTÕES
```css
--button-bg-primary: var(--color-primary);
--button-bg-primary-hover: var(--color-primary-hover);
--button-text-primary: #ffffff;
```

## 🌑 SOMBRAS & BORDAS
```css
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--border-radius-md: 0.5rem;   /* 8px */
--border-radius-lg: 0.75rem;  /* 12px */
```

---

## ✅ Checklist Validação 100%
- [ ] Todos paddings/margins usam `--spacing-X`
- [ ] Font-sizes usam `--font-size-X`
- [ ] Cores usam `--color-*`
- [ ] Bordas usam `--border-radius-X`
- [ ] Sombras usam `--shadow-X`
- [ ] Transições usam `--transition-*`
- [ ] Inputs têm `:hover`, `:focus`, `:disabled` definidos

**Exemplo de uso:**
"Gere um card usando `--spacing-4` e `--font-size-lg` com `--shadow-md` e `--border-radius-lg`"
