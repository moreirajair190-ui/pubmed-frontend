from openai import OpenAI
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import xml.etree.ElementTree as ET
import re
import json
import time
from typing import List, Dict, Any

client = OpenAI()
# cache simples em memória
QUERY_CACHE = {}
CACHE_TTL = 3600  # 1 hora

app = FastAPI(title="PubMed Backend", version="5.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://pubmed-frontend-f0tq13wdx-moreirajair190-4936s-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    question: str
    max_results: int = 10


class ClinicalAnswerRequest(BaseModel):
    question: str
    max_results: int = 5


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def get_cached_result(question: str):

    key = normalize_text(question).lower()

    if key in QUERY_CACHE:
        data, timestamp = QUERY_CACHE[key]

        if time.time() - timestamp < CACHE_TTL:
            return data

    return None


def save_cached_result(question: str, result):

    key = normalize_text(question).lower()

    QUERY_CACHE[key] = (result, time.time())


def search_pubmed_ids(query: str, max_results: int = 10) -> List[str]:
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"

    params = {
        "db": "pubmed",
        "term": query,
        "retmode": "json",
        "retmax": max_results,
        "sort": "relevance",
    }

    headers = {
        "User-Agent": "pubmed-clinical-ai/1.0"
    }

    for _ in range(3):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=30)

            if r.status_code == 429:
                time.sleep(2)
                continue

            r.raise_for_status()
            data = r.json()
            return data.get("esearchresult", {}).get("idlist", [])
        except Exception:
            time.sleep(1)

    return []


def infer_study_type(title: str, abstract: str) -> str:
    text = f"{title} {abstract}".lower()

    patterns = [
        ("meta-analysis", r"\bmeta-analysis\b|\bmeta analysis\b"),
        ("systematic review", r"\bsystematic review\b"),
        ("randomized controlled trial", r"\brandomized\b|\brandomised\b|\brct\b"),
        ("clinical trial", r"\bclinical trial\b"),
        ("cohort study", r"\bcohort\b"),
        ("case-control study", r"\bcase-control\b|\bcase control\b"),
        ("cross-sectional study", r"\bcross-sectional\b|\bcross sectional\b"),
        ("case series / case report", r"\bcase report\b|\bcase series\b"),
        ("animal / preclinical study", r"\bmouse\b|\bmice\b|\brat\b|\banimal\b|\bin vitro\b"),
    ]

    for label, pattern in patterns:
        if re.search(pattern, text):
            return label

    return "unspecified"


def score_study_type(study_type: str) -> int:
    scores = {
        "meta-analysis": 100,
        "systematic review": 95,
        "randomized controlled trial": 90,
        "clinical trial": 80,
        "cohort study": 70,
        "case-control study": 60,
        "cross-sectional study": 50,
        "case series / case report": 30,
        "animal / preclinical study": 10,
        "unspecified": 20,
    }
    return scores.get(study_type, 0)


def fetch_pubmed_details(ids: List[str]) -> List[Dict[str, Any]]:
    if not ids:
        return []

    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

    params = {
        "db": "pubmed",
        "id": ",".join(ids),
        "retmode": "xml",
    }

    headers = {
        "User-Agent": "pubmed-clinical-ai/1.0"
    }

    for _ in range(3):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=40)

            if r.status_code == 429:
                time.sleep(2)
                continue

            r.raise_for_status()
            break
        except Exception:
            time.sleep(1)
    else:
        return []

    root = ET.fromstring(r.text)
    articles = []

    for article in root.findall(".//PubmedArticle"):
        title = article.findtext(".//ArticleTitle", default="").strip()

        abstract_parts = article.findall(".//Abstract/AbstractText")
        abstract = " ".join(
            ["".join(part.itertext()).strip() for part in abstract_parts if "".join(part.itertext()).strip()]
        ).strip()

        pmid = article.findtext(".//PMID", default="").strip()

        year = article.findtext(".//PubDate/Year", default="").strip()
        if not year:
            medline_date = article.findtext(".//PubDate/MedlineDate", default="").strip()
            year_match = re.search(r"\b(19|20)\d{2}\b", medline_date)
            year = year_match.group(0) if year_match else ""

        journal = article.findtext(".//Journal/Title", default="").strip()

        study_type = infer_study_type(title, abstract)
        evidence_score = score_study_type(study_type)

        articles.append({
            "pmid": pmid,
            "title": title,
            "year": year,
            "journal": journal,
            "study_type": study_type,
            "evidence_score": evidence_score,
            "abstract": abstract,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else "",
        })

    return articles


def extract_keywords_simple(question: str) -> str:
    q = question.lower()

    stopwords = {
        "what", "is", "the", "relationship", "between", "and", "in", "with",
        "how", "does", "do", "for", "of", "to", "a", "an", "patients", "patient",
        "what's", "are", "be", "on", "or", "by", "from",
        "qual", "quais", "como", "dos", "das", "de", "da", "do", "em",
        "tratamento", "treatment", "medicamentoso", "drug", "therapy", "therapeutic",
        "fatores", "risco", "quadro", "clinico", "clínico", "tipos", "tipo",
    }

    q = re.sub(r"[^a-zA-Z0-9\s\-]", " ", q)
    tokens = [t for t in q.split() if t not in stopwords and len(t) > 2]
    return " ".join(tokens[:10])


def semantic_expand_query(query: str) -> str:
    synonym_map = {
        "diabetes": '("diabetes mellitus" OR diabetes)',
        "type 2 diabetes": '("type 2 diabetes" OR T2DM OR "diabetes mellitus type 2")',
        "type 1 diabetes": '("type 1 diabetes" OR T1DM)',
        "insulin": '("insulin therapy" OR insulin)',
        "sglt2": '("SGLT2 inhibitors" OR empagliflozin OR dapagliflozin OR canagliflozin)',
        "heart failure": '("heart failure" OR HF)',
        "hypertension": '("hypertension" OR "high blood pressure")',
        "obesity": '("obesity" OR obese)',
        "rheumatoid arthritis": '("rheumatoid arthritis" OR RA)',
        "migraine": '("migraine" OR "migraine disorder")',
        "headache": '("headache" OR migraine OR tension-type)',
        "cefaleia": '("headache" OR migraine OR tension-type)',
        "cancer": '("neoplasms" OR cancer OR tumor)',
        "stroke": '("stroke" OR "cerebrovascular accident")',
        "metformin": '("metformin")',
        "statins": '("statins" OR atorvastatin OR simvastatin)',
        "glp1": '("GLP-1 receptor agonist" OR semaglutide OR liraglutide)',
        "artrite reumatoide": '("rheumatoid arthritis" OR RA)',
        "pancreatite aguda": '("acute pancreatitis")',
    }

    expanded = query.lower()

    for key, value in synonym_map.items():
        if key in expanded:
            expanded = expanded.replace(key, value)

    return expanded


def generate_search_plan(question: str) -> Dict[str, Any]:
    prompt = f"""
Você é um especialista em busca biomédica para PubMed.

Receberá uma pergunta clínica ou biomédica.
Sua tarefa é retornar JSON válido com:
- normalized_question: versão curta em inglês biomédico
- keywords: lista curta de termos principais
- queries: lista de 4 a 6 queries curtas e úteis para PubMed

Regras:
- Use inglês biomédico.
- Não escreva explicações.
- Gere queries curtas, objetivas e de alta chance de recuperar artigos.
- Inclua sinônimos quando útil.
- Se a pergunta for sobre tratamento, gere pelo menos 1 query focada em intervenção e 1 focada em doença.
- Se a pergunta for comparativa, gere pelo menos 1 query sem palavras excessivamente narrativas.
- Retorne apenas JSON.

Pergunta:
{question}
"""

    try:
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt
        )

        text = response.output_text.strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("JSON não encontrado na resposta da OpenAI.")

        data = json.loads(match.group(0))

        normalized_question = normalize_text(data.get("normalized_question", question))
        keywords = data.get("keywords", [])
        queries = data.get("queries", [])

        if not isinstance(keywords, list):
            keywords = []
        if not isinstance(queries, list):
            queries = []

        if not queries:
            simple = extract_keywords_simple(question)
            queries = [simple, semantic_expand_query(simple)]

        expanded_queries = []
        for q in queries:
            if isinstance(q, str) and q.strip():
                expanded_queries.append(normalize_text(q))
                expanded_queries.append(normalize_text(semantic_expand_query(q)))

        # remove duplicadas preservando ordem
        seen = set()
        deduped_queries = []
        for q in expanded_queries:
            if q not in seen:
                seen.add(q)
                deduped_queries.append(q)

        return {
            "normalized_question": normalized_question,
            "keywords": keywords[:10],
            "queries": deduped_queries[:8],
        }

    except Exception:
        simple = extract_keywords_simple(question)
        expanded = semantic_expand_query(simple)
        return {
            "normalized_question": question,
            "keywords": simple.split(),
            "queries": [
                question,
                simple,
                expanded,
            ],
        }


def run_multiple_pubmed_queries(queries: List[str], max_results_per_query: int = 5) -> List[str]:
    all_ids = []
    seen = set()

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_query = {
            executor.submit(search_pubmed_ids, query, max_results_per_query): query
            for query in queries if query.strip()
        }

        for future in as_completed(future_to_query):
            try:
                ids = future.result()
                for pmid in ids:
                    if pmid not in seen:
                        seen.add(pmid)
                        all_ids.append(pmid)
            except Exception:
                continue

    return all_ids


def score_article_relevance(question: str, article: Dict[str, Any]) -> int:
    score = article.get("evidence_score", 0)

    q_tokens = set(re.findall(r"\w+", question.lower()))
    title_tokens = set(re.findall(r"\w+", article.get("title", "").lower()))
    abstract_tokens = set(re.findall(r"\w+", article.get("abstract", "").lower()))

    overlap = len(q_tokens & (title_tokens | abstract_tokens))
    score += overlap * 2

    if article.get("abstract"):
        score += 5

    year = article.get("year", "")
    if year.isdigit():
        y = int(year)
        if y >= 2022:
            score += 8
        elif y >= 2018:
            score += 5
        elif y >= 2014:
            score += 2

    return score


def rerank_articles(question: str, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    reranked = []
    for article in articles:
        article = dict(article)
        article["final_score"] = score_article_relevance(question, article)
        reranked.append(article)

    reranked.sort(key=lambda x: x["final_score"], reverse=True)
    return reranked


def layered_pubmed_search(question: str, max_results: int = 5) -> Dict[str, Any]:
    plan = generate_search_plan(question)
    queries = plan.get("queries", [])

    ids = run_multiple_pubmed_queries(queries, max_results_per_query=max_results)

    if not ids:
        simple = extract_keywords_simple(question)

        fallback_queries = [
            question,
            simple,
            semantic_expand_query(simple),
            f"{simple} treatment",
            f"{simple} therapy",
            f"{simple} clinical trial",
        ]

        ids = run_multiple_pubmed_queries(fallback_queries, max_results_per_query=max_results)
        queries = fallback_queries

    return {
        "normalized_question": plan.get("normalized_question", question),
        "keywords": plan.get("keywords", []),
        "queries": queries,
        "pmids": ids,
    }


def build_articles_context(articles: List[Dict[str, Any]], max_articles: int = 5) -> str:
    chunks = []

    for idx, article in enumerate(articles[:max_articles], start=1):
        chunks.append(
            f"""
ARTIGO {idx}
PMID: {article.get('pmid', '')}
TÍTULO: {article.get('title', '')}
ANO: {article.get('year', '')}
JOURNAL: {article.get('journal', '')}
TIPO DE ESTUDO: {article.get('study_type', '')}
SCORE DE EVIDÊNCIA: {article.get('evidence_score', '')}
SCORE FINAL: {article.get('final_score', '')}
ABSTRACT: {article.get('abstract', '')}
URL: {article.get('url', '')}
""".strip()
        )

    return "\n\n".join(chunks)


def generate_clinical_summary(question: str, articles: List[Dict[str, Any]]) -> str:
    context = build_articles_context(articles, max_articles=5)

    prompt = f"""
Você é um especialista em medicina baseada em evidências.

Responda à pergunta usando apenas os artigos abaixo.

Regras:
- Não invente dados.
- Diferencie força da evidência.
- Diga explicitamente quando a evidência for fraca, conflitante ou indireta.
- Não faça diagnóstico individual nem prescrição personalizada.
- Responda em português.
- Use linguagem médica clara.

Formato obrigatório:
1. Resposta curta
2. Síntese da evidência
3. Nível/tipo de evidência
4. Limitações
5. Observação clínica prudente

Pergunta:
{question}

Artigos:
{context}
"""

    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )

    text = ""
    for item in resp.output:
        if item.type == "message":
            for c in item.content:
                if c.type == "output_text":
                    text += c.text

    return text or "Não foi possível gerar o resumo."


@app.get("/")
def root():
    return {"ok": True, "message": "PubMed backend ativo"}


@app.get("/privacy")
def privacy():
    return {
        "service": "PubMed Backend",
        "privacy": "Este serviço recebe perguntas biomédicas, consulta o PubMed e gera síntese clínica baseada nos artigos encontrados."
    }


@app.post("/search-pubmed")
def search_pubmed(req: SearchRequest):
    plan = layered_pubmed_search(req.question, req.max_results)
    ids = plan["pmids"]

    articles = fetch_pubmed_details(ids)
    articles = rerank_articles(req.question, articles)

    evidence_summary = {
        "meta_analysis": sum(1 for a in articles if a["study_type"] == "meta-analysis"),
        "systematic_review": sum(1 for a in articles if a["study_type"] == "systematic review"),
        "randomized_controlled_trial": sum(1 for a in articles if a["study_type"] == "randomized controlled trial"),
        "clinical_trial": sum(1 for a in articles if a["study_type"] == "clinical trial"),
        "observational": sum(1 for a in articles if a["study_type"] in ["cohort study", "case-control study", "cross-sectional study"]),
        "case_report_or_series": sum(1 for a in articles if a["study_type"] == "case series / case report"),
        "preclinical": sum(1 for a in articles if a["study_type"] == "animal / preclinical study"),
        "unspecified": sum(1 for a in articles if a["study_type"] == "unspecified"),
    }

    return {
        "original_query": req.question,
        "normalized_question": plan["normalized_question"],
        "keywords": plan["keywords"],
        "pubmed_queries": plan["queries"],
        "count": len(articles),
        "evidence_summary": evidence_summary,
        "articles": articles[:req.max_results],
    }


@app.post("/clinical-answer")
cached = get_cached_result(req.question)

if cached:
    return cached
def clinical_answer(req: ClinicalAnswerRequest):
    plan = layered_pubmed_search(req.question, req.max_results)
    ids = plan["pmids"]

    articles = fetch_pubmed_details(ids)
    articles = rerank_articles(req.question, articles)

    if not articles:
save_cached_result(req.question, result)

return result
        result = {
            "question": req.question,
            "normalized_question": plan["normalized_question"],
            "keywords": plan["keywords"],
            "pubmed_queries": plan["queries"],
            "count": 0,
            "clinical_summary": "Não encontrei artigos relevantes para essa pergunta com a estratégia atual de busca. Reformule a pergunta com foco em doença, intervenção ou desfecho clínico.",
            "articles": [],
        }

    top_articles = articles[:req.max_results]
    summary = generate_clinical_summary(req.question, top_articles)

    return {
        "question": req.question,
        "normalized_question": plan["normalized_question"],
        "keywords": plan["keywords"],
        "pubmed_queries": plan["queries"],
        "count": len(top_articles),
        "clinical_summary": summary,
        "articles": top_articles,
    }
