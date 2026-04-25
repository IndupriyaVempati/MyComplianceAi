import asyncio
import sys
import os

from passlib.context import CryptContext

# Add the backend directory to the Python path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.storage import create_user_credentials
from app.lifespan import get_pg_pool

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin(username, password):
    # Initialize the database connection pool manually
    import asyncpg
    from app.lifespan import _init_connection
    
    app_pool = await asyncpg.create_pool(
        database=os.environ.get("POSTGRES_DB", "opengpts"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        init=_init_connection,
    )
    # Monkey-patch the global pool used by storage
    import app.lifespan
    app.lifespan._pg_pool = app_pool
    
    hashed_password = pwd_context.hash(password)
    user, created = await create_user_credentials(username, hashed_password, is_admin=True)
    
    if created:
        print(f"Admin user '{username}' created successfully!")
    else:
        print(f"User '{username}' already exists. Password and admin status updated.")
        
    await app_pool.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python create_admin.py <username> <password>")
        sys.exit(1)
        
    username = sys.argv[1]
    password = sys.argv[2]
    
    asyncio.run(create_admin(username, password))
