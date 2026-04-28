"""Brand listing endpoint — surfaces the static brand configs."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException

from app.security import current_user
from app.services.brand_loader import list_brands, load_brand_config

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("")
async def get_brands(_: Annotated[dict, Depends(current_user)]):
    return {"brands": list_brands()}


@router.get("/{brand_id}")
async def get_brand(brand_id: str, _: Annotated[dict, Depends(current_user)]):
    try:
        return load_brand_config(brand_id)
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))
