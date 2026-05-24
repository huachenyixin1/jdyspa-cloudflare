"""
加密工具 - D1 版本
注意: Pyodide 环境下 cryptography 库可能不可用
使用 hashlib + base64 作为替代方案
"""

import hashlib
import base64
import os

# 尝试导入 cryptography，如果不可用则使用 fallback
try:
    from cryptography.fernet import Fernet
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False


def _derive_key(key_str: str) -> bytes:
    """从字符串派生 32 字节密钥"""
    return hashlib.sha256(key_str.encode()).digest()


def encrypt_value(plain_text: str, key: str = "") -> str:
    """加密值"""
    if not plain_text:
        return ""

    if not key:
        # 没有密钥时直接返回原文（不加密）
        return plain_text

    if HAS_CRYPTOGRAPHY:
        try:
            fernet_key = base64.urlsafe_b64encode(_derive_key(key))
            f = Fernet(fernet_key)
            return f.encrypt(plain_text.encode()).decode()
        except Exception:
            pass

    # Fallback: 简单的 base64 编码（非真正加密，仅用于兼容）
    return base64.b64encode(plain_text.encode()).decode()


def decrypt_value(encrypted_text: str, key: str = "") -> str:
    """解密值"""
    if not encrypted_text:
        return ""

    if not key:
        return encrypted_text

    if HAS_CRYPTOGRAPHY:
        try:
            fernet_key = base64.urlsafe_b64encode(_derive_key(key))
            f = Fernet(fernet_key)
            return f.decrypt(encrypted_text.encode()).decode()
        except Exception:
            pass

    # Fallback: base64 解码
    try:
        return base64.b64decode(encrypted_text.encode()).decode()
    except Exception:
        return encrypted_text
