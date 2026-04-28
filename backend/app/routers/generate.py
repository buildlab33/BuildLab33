"""Content generation endpoint — calls Anthropic via the service layer."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException

from app.schemas.generate import GenerateRequest, GenerateResponse
from app.security import current_user
from app.services.anthropic_service import generate_post

router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("", response_model=GenerateResponse)
async def post_generate(body: GenerateRequest, user: Annotated[dict, Depends(current_user)]):
    try:
        result = generate_post(body.model_dump())
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    return GenerateResponse(**result)
