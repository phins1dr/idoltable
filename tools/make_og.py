#!/usr/bin/env python3
"""OG 공유 카드(1200x630)를 만든다. 외부 이미지 없이 Pillow로만 그린다.
사용: python3 tools/make_og.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
FONT = "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf"
BG = (10, 12, 16)
OUT = "assets/og-cover.png"


def font(size):
    return ImageFont.truetype(FONT, size)


def blob(size, color, opacity=90):
    layer = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((size // 2, size // 2, size * 2 - size // 2, size * 2 - size // 2), fill=color + (opacity,))
    return layer.filter(ImageFilter.GaussianBlur(size // 3))


def gradient_text_mask(text, fnt, pad=20):
    box = fnt.getbbox(text)
    w, h = box[2] - box[0] + pad * 2, box[3] - box[1] + pad * 2
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text((pad - box[0], pad - box[1]), text, font=fnt, fill=255)
    return mask


def main():
    base = Image.new("RGB", (W, H), BG)
    # 배경 글로우
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow.alpha_composite(blob(520, (157, 78, 221), 120), (-160, -220))
    glow.alpha_composite(blob(460, (255, 0, 127), 110), (820, 250))
    base = Image.alpha_composite(base.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(40)))

    d = ImageDraw.Draw(base)

    # 은은한 하이라이트 라인 (별도 레이어에 그려 알파 합성)
    lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lines)
    for x in range(-H, W, 34):
        ld.line([(x, H), (x + H, 0)], fill=(255, 255, 255, 10), width=1)
    base = Image.alpha_composite(base, lines)
    d = ImageDraw.Draw(base)

    # 브랜드 배지
    d.rounded_rectangle((72, 64, 148, 118), radius=14, fill=(255, 0, 127))
    d.text((110, 91), "VS", font=font(28), fill=(255, 255, 255), anchor="mm")
    d.text((164, 78), "IDOL QUIZ", font=font(26), fill=(255, 77, 141))
    d.text((164, 108), "K-POP 팬덤 대항전", font=font(20), fill=(150, 156, 172))

    # 헤드라인
    d.text((72, 168), "내 최애 그룹을 위해", font=font(62), fill=(214, 200, 235))
    head = "10문제를 맞혀라"
    fnt = font(92)
    mask = gradient_text_mask(head, fnt)
    grad = Image.new("RGBA", mask.size, (255, 255, 255, 255))
    gd = ImageDraw.Draw(grad)
    for y in range(mask.size[1]):
        t = y / max(1, mask.size[1] - 1)
        gd.line([(0, y), (mask.size[0], y)],
                fill=(int(255 - 30 * t), int(255 - 90 * t), int(255 - 20 * t), 255))
    base.paste(grad, (72 - 18, 246 - 18), mask)
    d = ImageDraw.Draw(base)

    # 서브카피
    d.text((76, 372), "정답마다 우리 팀에 점수  ·  매일 자정 새 문제  ·  주간 팬덤 순위표",
           font=font(28), fill=(160, 167, 184))

    # 팀 칩
    chips = [("BTS", (138, 43, 226)), ("세븐틴", (0, 180, 216)),
             ("스트레이키즈", (255, 159, 28)), ("리센느", (255, 77, 141))]
    x = 72
    for name, color in chips:
        f = font(26)
        w = d.textlength(name, font=f)
        box = (x, 432, x + w + 62, 490)
        d.rounded_rectangle(box, radius=29, fill=(24, 27, 38), outline=color + (140,))
        d.ellipse((x + 20, 452, x + 36, 468), fill=color)
        d.text((x + 46, 449), name, font=f, fill=(240, 242, 248))
        x = box[2] + 12

    # 하단
    d.text((72, 540), "10초 스피드 퀴즈", font=font(24), fill=(120, 127, 145))
    d.text((72, 572), "phins1dr.github.io/idoltable", font=font(26), fill=(0, 240, 255))

    # 점수 배지 느낌 장식
    d.rounded_rectangle((900, 430, 1128, 578), radius=22, fill=(20, 24, 34), outline=(199, 125, 255, 120))
    d.text((1014, 462), "오늘의", font=font(22), fill=(150, 156, 172), anchor="ma")
    d.text((1014, 500), "10문제", font=font(38), fill=(255, 190, 11), anchor="ma")
    d.text((1014, 548), "쉬움·보통·덕후", font=font(20), fill=(140, 147, 167), anchor="ma")

    os.makedirs("assets", exist_ok=True)
    base.convert("RGB").save(OUT, "PNG", optimize=True)
    print("saved", OUT, base.size)


if __name__ == "__main__":
    main()
