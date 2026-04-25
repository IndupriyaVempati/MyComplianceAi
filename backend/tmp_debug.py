import sys
import asyncio
import os

sys.path.insert(0, '/backend')

async def main():
    try:
        from app.lifespan import get_pg_pool
        from app.agent import agent as app
        from langchain_core.runnables import RunnableConfig
        import asyncpg
        
        tid = "1b6a2d71-2b9c-420e-8081-12248618db09"
        
        async with get_pg_pool().acquire() as conn:
            rows = await conn.fetch("SELECT checkpoint_id, checkpoint_ns FROM checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC", tid)
            print(f"Total checkpoints: {len(rows)}")
            for row in rows:
                cid = row["checkpoint_id"]
                cns = row["checkpoint_ns"]
                config = {"configurable": {"thread_id": tid, "checkpoint_id": cid, "checkpoint_ns": cns}}
                try:
                    state = await app.aget_state(config)
                    msgs = state.values.get('messages', [])
                    print(f"Checkpoint {cid} is VALID! Messages: {len(msgs)}")
                    for m in msgs:
                        print(f"  - {m.type}: {m.content[:30]}")
                except Exception as e:
                    print(f"Checkpoint {cid} is CORRUPT: {e}")
    except Exception as e:
        print(f"Outer error: {e}")

asyncio.run(main())
