# Continuação do server.py

# Operators endpoints
@api_router.post("/operators", response_model=Operator)
async def create_operator(operator_data: OperatorCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    operator_dict = operator_data.model_dump()
    operator_obj = Operator(**operator_dict)
    
    doc = operator_obj.model_dump()
    await db.operators.insert_one(doc)
    return operator_obj

@api_router.get("/operators")
async def get_operators(current_user: dict = Depends(get_current_user), include_hidden: bool = False):
    query = {"active": True}
    if not include_hidden:
        query["hidden"] = False
    
    operators = await db.operators.find(query, {"_id": 0}).to_list(1000)
    return operators

@api_router.put("/operators/{operator_id}")
async def update_operator(operator_id: str, operator_data: OperatorCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403)
    
    update_dict = operator_data.model_dump()
    await db.operators.update_one({"id": operator_id}, {"$set": update_dict})
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    return operator

@api_router.post("/operators/{operator_id}/toggle-visibility")
async def toggle_operator_visibility(operator_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403)
    
    operator = await db.operators.find_one({"id": operator_id})
    if not operator:
        raise HTTPException(status_code=404)
    
    new_hidden = not operator.get('hidden', False)
    await db.operators.update_one({"id": operator_id}, {"$set": {"hidden": new_hidden}})
    
    return {"message": "Visibility toggled", "hidden": new_hidden}

@api_router.delete("/operators/{operator_id}")
async def delete_operator(operator_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    await db.operators.delete_one({"id": operator_id})
    return {"message": "Operator deleted"}
