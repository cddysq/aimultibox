# -*- coding: utf-8 -*-
"""工具加载器"""

import importlib
from pathlib import Path
from typing import Dict, Any, List
from fastapi import FastAPI


class ToolLoader:
    """工具插件加载器，单例模式"""
    
    _instance = None
    _tools: Dict[str, Any] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self.tools_path = Path(__file__).parent.parent / "tools"
    
    @classmethod
    def get_registered_tools(cls) -> List[Dict[str, Any]]:
        """获取已注册的工具列表"""
        return [
            {k: v for k, v in tool.items() if k != "module"}
            for tool in cls._tools.values()
        ]
    
    def discover_tools(self) -> List[str]:
        """扫描 tools 目录，发现可用工具"""
        tools = []
        if not self.tools_path.exists():
            return tools
        
        for item in self.tools_path.iterdir():
            if item.is_dir() and not item.name.startswith("_"):
                if (item / "api.py").exists():
                    tools.append(item.name)
        
        return tools
    
    def load_tool(self, tool_name: str, app: FastAPI) -> bool:
        """加载单个工具"""
        try:
            init_module = importlib.import_module(f"aimultibox.tools.{tool_name}")
            
            if not hasattr(init_module, "TOOL_META"):
                print(f"  ✗ {tool_name}: 缺少 TOOL_META")
                return False
            
            meta = init_module.TOOL_META
            tool_id = meta.get("id", tool_name.replace('_', '-'))
            
            api_module = importlib.import_module(f"aimultibox.tools.{tool_name}.api")
            
            if not hasattr(api_module, "router"):
                print(f"  ✗ {tool_name}: 缺少 router")
                return False
            
            prefix = f"/api/tools/{tool_id}"
            app.include_router(api_module.router, prefix=prefix, tags=[tool_name])
            
            ToolLoader._tools[tool_name] = {
                **meta,
                "endpoint": prefix,
                "status": "active",
                "module": api_module,
            }
            
            print(f"  ✓ {meta.get('name', tool_name)} -> {prefix}")
            return True
                
        except Exception as e:
            print(f"  ✗ {tool_name}: {e}")
            return False
    
    def load_all_tools(self, app: FastAPI) -> None:
        """加载所有工具"""
        tools = self.discover_tools()
        print(f"📦 发现 {len(tools)} 个工具")
        
        for tool_name in tools:
            self.load_tool(tool_name, app)
