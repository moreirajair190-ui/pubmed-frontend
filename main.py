def generate_clinical_summary(question: str, articles: list):
    context = "\n\n".join(
        [f"{a.get('title','')}: {a.get('abstract','')}" for a in articles[:5]]
    )

    prompt = f"""
Você é um assistente médico baseado em evidências.

Pergunta clínica:
{question}

Artigos relevantes:
{context}

Forneça:
1. resposta curta
2. síntese da evidência
3. nível/tipo de evidência
4. limitações
5. observação clínica prudente
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
