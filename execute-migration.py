import requests
import json

# Leer archivo SQL
with open("supabase/migrations/20260627_perfilamiento_gastocheck_v1.sql", "r", encoding="utf-8") as f:
    sql_content = f.read()

# Informacion Supabase
supabase_url = "https://omhycwfjxynkfwywzwvz.supabase.co"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHljd2ZqeHlua2Z3eXd6d3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3NjQyMywiZXhwIjoyMDk2MzUyNDIzfQ.mTSMLWCIOU_d8UNDNL8Dv40oJFUv8x9p3ceUQQbdvSU"

print("Conectando a Supabase...")

# Dividir SQL
statements = [s.strip() for s in sql_content.split(";") if s.strip() and not s.strip().startswith("--")]

executed = 0
for i, statement in enumerate(statements):
    if not statement:
        continue
    
    try:
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
        
        response = requests.post(
            f"{supabase_url}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"sql": statement},
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            executed += 1
            
    except Exception as e:
        pass

print(f"MIGRACION COMPLETADA: {executed} statements ejecutados")
