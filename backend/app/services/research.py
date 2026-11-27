import asyncio
import httpx
import xml.etree.ElementTree as ET

HEADERS = {"User-Agent":"DataAnalyzer/0.1 (academic research assistant)"}

async def search_literature(query: str, sources: list[str], limit: int) -> dict:
    tasks = []
    names = []
    async with httpx.AsyncClient(timeout=15, headers=HEADERS, follow_redirects=True) as client:
        if "openalex" in sources:
            tasks.append(_openalex(client, query, limit)); names.append("openalex")
        if "crossref" in sources:
            tasks.append(_crossref(client, query, limit)); names.append("crossref")
        if "arxiv" in sources:
            tasks.append(_arxiv(client, query, limit)); names.append("arxiv")
        results = await asyncio.gather(*tasks, return_exceptions=True)
    items, errors = [], []
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            errors.append({"source":name,"error":str(result)})
        else:
            items.extend(result)
    # Deduplicate by DOI or normalized title, preserving source metadata.
    unique = {}
    for item in items:
        key = (item.get("doi") or item.get("title","").strip().lower())
        if key and key not in unique:
            unique[key] = item
    return {"query":query,"results":list(unique.values())[:limit],"sources_used":names,"source_errors":errors,"notice":"Metadata search only. Verify relevance, DOI, version and access rights before citing."}

async def _openalex(client, query, limit):
    r = await client.get("https://api.openalex.org/works", params={"search":query,"per-page":limit,"select":"id,doi,title,publication_year,authorships,primary_location"})
    r.raise_for_status()
    out=[]
    for x in r.json().get("results",[]):
        authors=[a.get("author",{}).get("display_name") for a in x.get("authorships",[])[:8]]
        out.append({"source":"OpenAlex","title":x.get("title"),"year":x.get("publication_year"),"doi":x.get("doi"),"authors":authors,"url":x.get("doi") or x.get("id")})
    return out

async def _crossref(client, query, limit):
    r=await client.get("https://api.crossref.org/works",params={"query":query,"rows":limit})
    r.raise_for_status()
    out=[]
    for x in r.json().get("message",{}).get("items",[]):
        title=(x.get("title") or [None])[0]
        out.append({"source":"Crossref","title":title,"year":(x.get("published-print") or x.get("published-online") or {}).get("date-parts",[[None]])[0][0],"doi":x.get("DOI"),"authors":[a.get("given","")+" "+a.get("family","") for a in x.get("author",[])[:8]],"url":("https://doi.org/"+x["DOI"]) if x.get("DOI") else x.get("URL")})
    return out

async def _arxiv(client, query, limit):
    r=await client.get("https://export.arxiv.org/api/query",params={"search_query":"all:"+query,"start":0,"max_results":limit})
    r.raise_for_status()
    root=ET.fromstring(r.text)
    ns={"a":"http://www.w3.org/2005/Atom"}
    out=[]
    for entry in root.findall("a:entry",ns):
        out.append({"source":"arXiv","title":" ".join((entry.findtext("a:title",default="",namespaces=ns)).split()),"year":(entry.findtext("a:published",default="",namespaces=ns)[:4] or None),"authors":[a.text for a in entry.findall("a:author/a:name",ns)[:8]],"url":entry.findtext("a:id",namespaces=ns)})
    return out
