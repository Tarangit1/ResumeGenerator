import asyncio
from resume_parser import parse_resume

async def main():
    try:
        res = await parse_resume("Test latex content")
        print("Success:", res)
    except Exception as e:
        import traceback
        with open("error.log", "w") as f:
            traceback.print_exc(file=f)

if __name__ == "__main__":
    asyncio.run(main())
