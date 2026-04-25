import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env.local"))

async def run():
    conn = await asyncpg.connect(
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        database=os.environ.get("POSTGRES_DB", "postgres")
    )
    
    with open("migrations/000008_add_name_phone_to_user.up.sql", "r") as f:
        sql = f.read()
        
    await conn.execute(sql)
    print("Migration successful")
    await conn.close()
            
if __name__ == "__main__":
    asyncio.run(run())
