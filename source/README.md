# Fonte da landing page

`landing-bundle.html` é o arquivo exportado da ferramenta de design (tudo embutido num só HTML).
O site publicado é gerado a partir dele:

```bash
node source/build.js source/landing-bundle.html .
```

Isso recria `index.html` e a pasta `assets/` na raiz. Esta pasta `source/` não é publicada na Vercel (veja `.vercelignore`).
