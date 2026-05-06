"""
LLM Service using LiteLLM for unified API across providers.
Supports: Ollama (local), Groq (cloud), OpenAI-compatible APIs
"""
import json
import logging
from typing import Optional
from litellm import acompletion
from config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    """
    LiteLLM-based service for agent LLM calls.
    
    Usage:
        service = OllamaService()
        response = await service.generate("Analyze flight data...")
    """
    
    def __init__(self, base_url: str = None, model: str = None):
        # Build model string for litellm (e.g., "ollama/llama3.2" or "groq/llama3-8b-8192")
        provider = settings.LLM_PROVIDER
        
        if model:
            self.model = f"{provider}/{model}" if "/" not in model else model
        elif settings.LLM_MODEL:
            self.model = f"{provider}/{settings.LLM_MODEL}"
        else:
            # Default models per provider
            defaults = {
                "ollama": "ollama/llama3.2",
                "groq": "groq/llama3-8b-8192",
                "openai": "openai/gpt-3.5-turbo"
            }
            self.model = defaults.get(provider, "ollama/llama3.2")
        
        self.base_url = base_url or settings.LLM_URL or settings.OLLAMA_URL
        self.api_key = settings.LLM_API_KEY
        
        logger.info(f"OllamaService initialized: model={self.model}, url={self.base_url}")
    
    async def generate(self, prompt: str, system: str = None, temperature: float = 0.3) -> str:
        """Generate text using LiteLLM."""
        try:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            
            # Build kwargs for litellm
            kwargs = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": settings.LLM_MAX_TOKENS,
            }
            
            # Add provider-specific configs
            if self.api_key:
                kwargs["api_key"] = self.api_key
            if self.base_url and settings.LLM_PROVIDER == "ollama":
                kwargs["api_base"] = self.base_url
            elif self.base_url and settings.LLM_PROVIDER in ["groq", "openai"]:
                kwargs["api_base"] = self.base_url
            
            response = await acompletion(**kwargs)
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            return ""
    
    async def generate_json(self, prompt: str, system: str = None, temperature: float = 0.3) -> dict:
        """Generate and parse JSON response."""
        text = await self.generate(prompt, system, temperature)
        
        if not text:
            return {"error": "Empty response"}
        
        # Try to extract JSON from markdown code blocks
        try:
            if "```json" in text:
                start = text.find("```json") + 7
                end = text.find("```", start)
                text = text[start:end].strip()
            elif "```" in text:
                start = text.find("```") + 3
                end = text.find("```", start)
                text = text[start:end].strip()
            
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON from LLM: {text[:100]}...")
            return {"raw_response": text}
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return {"raw_response": text}
