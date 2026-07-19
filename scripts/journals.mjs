// Single source of truth for the snapshot builder.
// (The app keeps its own copy of the journal *metadata* for styling; the builder
//  needs the feed URLs. Keep the id/lang/feeds here in sync with index.html.)

export const CAT_ORDER = ['Latest', 'World', 'Europe', 'Politics', 'Business', 'Tech', 'Science', 'Culture', 'Sports'];
export const AGG_CATS  = ['World', 'Europe', 'Politics', 'Business', 'Tech', 'Science', 'Culture', 'Sports'];
export const UI_LANGS  = ['it', 'en', 'fi'];

export const JOURNALS = [
  { id: 'guardian', lang: 'en', feeds: {
    Latest:'https://www.theguardian.com/international/rss', World:'https://www.theguardian.com/world/rss',
    Europe:'https://www.theguardian.com/world/europe-news/rss', Politics:'https://www.theguardian.com/politics/rss',
    Business:'https://www.theguardian.com/uk/business/rss', Tech:'https://www.theguardian.com/technology/rss',
    Science:'https://www.theguardian.com/science/rss', Culture:'https://www.theguardian.com/culture/rss',
    Sports:'https://www.theguardian.com/uk/sport/rss' } },
  { id: 'bbc', lang: 'en', feeds: {
    Latest:'https://feeds.bbci.co.uk/news/rss.xml', World:'https://feeds.bbci.co.uk/news/world/rss.xml',
    Europe:'https://feeds.bbci.co.uk/news/world/europe/rss.xml', Politics:'https://feeds.bbci.co.uk/news/politics/rss.xml',
    Business:'https://feeds.bbci.co.uk/news/business/rss.xml', Tech:'https://feeds.bbci.co.uk/news/technology/rss.xml',
    Science:'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', Culture:'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' } },
  { id: 'dw', lang: 'en', feeds: {
    Latest:'https://rss.dw.com/xml/rss-en-all', World:'https://rss.dw.com/xml/rss-en-world',
    Europe:'https://rss.dw.com/xml/rss-en-eu', Business:'https://rss.dw.com/xml/rss-en-bus',
    Science:'https://rss.dw.com/xml/rss-en-sci', Culture:'https://rss.dw.com/xml/rss-en-cul',
    Sports:'https://rss.dw.com/xml/rss-en-spo' } },
  { id: 'france24', lang: 'en', feeds: {
    Latest:'https://www.france24.com/en/rss', World:'https://www.france24.com/en/world/rss',
    Europe:'https://www.france24.com/en/europe/rss', Business:'https://www.france24.com/en/business-tech/rss',
    Culture:'https://www.france24.com/en/culture/rss', Sports:'https://www.france24.com/en/sport/rss' } },
  { id: 'euronews', lang: 'en', feeds: {
    Latest:'https://www.euronews.com/rss?format=mrss&level=theme&name=news',
    Europe:'https://www.euronews.com/rss?format=mrss&level=vertical&name=my-europe',
    Business:'https://www.euronews.com/rss?format=mrss&level=vertical&name=business',
    Tech:'https://www.euronews.com/rss?format=mrss&level=vertical&name=next',
    Culture:'https://www.euronews.com/rss?format=mrss&level=vertical&name=culture' } },
  { id: 'repubblica', lang: 'it', feeds: {
    Latest:'https://www.repubblica.it/rss/homepage/rss2.0.xml', World:'https://www.repubblica.it/rss/esteri/rss2.0.xml',
    Politics:'https://www.repubblica.it/rss/politica/rss2.0.xml', Business:'https://www.repubblica.it/rss/economia/rss2.0.xml',
    Tech:'https://www.repubblica.it/rss/tecnologia/rss2.0.xml', Science:'https://www.repubblica.it/rss/scienze/rss2.0.xml',
    Culture:'https://www.repubblica.it/rss/spettacoli_e_cultura/rss2.0.xml', Sports:'https://www.repubblica.it/rss/sport/rss2.0.xml' } },
  { id: 'corriere', lang: 'it', feeds: {
    Latest:'https://xml2.corriereobjects.it/rss/homepage.xml', World:'https://xml2.corriereobjects.it/rss/esteri.xml',
    Politics:'https://xml2.corriereobjects.it/rss/politica.xml', Business:'https://xml2.corriereobjects.it/rss/economia.xml',
    Tech:'https://xml2.corriereobjects.it/rss/tecnologia.xml', Science:'https://xml2.corriereobjects.it/rss/scienze.xml',
    Culture:'https://xml2.corriereobjects.it/rss/cultura.xml', Sports:'https://xml2.corriereobjects.it/rss/sport.xml' } },
  { id: 'lemonde', lang: 'fr', feeds: {
    Latest:'https://www.lemonde.fr/rss/une.xml', World:'https://www.lemonde.fr/international/rss_full.xml',
    Europe:'https://www.lemonde.fr/europe/rss_full.xml', Politics:'https://www.lemonde.fr/politique/rss_full.xml',
    Business:'https://www.lemonde.fr/economie/rss_full.xml', Tech:'https://www.lemonde.fr/pixels/rss_full.xml',
    Science:'https://www.lemonde.fr/sciences/rss_full.xml', Culture:'https://www.lemonde.fr/culture/rss_full.xml',
    Sports:'https://www.lemonde.fr/sport/rss_full.xml' } },
  { id: 'elpais', lang: 'es', feeds: {
    Latest:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
    World:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
    Politics:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada',
    Business:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    Tech:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada',
    Science:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada',
    Culture:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada',
    Sports:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada' } },
  { id: 'spiegel', lang: 'de', feeds: {
    Latest:'https://www.spiegel.de/schlagzeilen/index.rss', World:'https://www.spiegel.de/ausland/index.rss',
    Politics:'https://www.spiegel.de/politik/index.rss', Business:'https://www.spiegel.de/wirtschaft/index.rss',
    Tech:'https://www.spiegel.de/netzwelt/index.rss', Science:'https://www.spiegel.de/wissenschaft/index.rss',
    Culture:'https://www.spiegel.de/kultur/index.rss', Sports:'https://www.spiegel.de/sport/index.rss' } },
];
