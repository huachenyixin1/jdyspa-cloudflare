"""
邮件工具 - D1 版本
注意: Cloudflare Workers 中无法使用 SMTP 发送邮件
替代方案: 使用 Cloudflare Email Workers 或第三方 API（如 Resend、SendGrid）
"""


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str = None,
):
    """
    发送邮件 - Workers 版本
    在 Cloudflare Workers 中，需要使用第三方邮件 API
    """
    # TODO: 接入 Cloudflare Email Workers 或第三方邮件 API
    # 目前仅记录日志，不实际发送
    print(f"[EMAIL] To: {to_email}, Subject: {subject}")
    return True


async def send_reset_password_email(email: str, reset_token: str, username: str):
    """发送密码重置邮件"""
    # TODO: 实现邮件发送
    print(f"[RESET EMAIL] email={email}, token={reset_token}, username={username}")
    return True


async def send_welcome_email(email: str, username: str):
    """发送欢迎邮件"""
    print(f"[WELCOME EMAIL] email={email}, username={username}")
    return True
