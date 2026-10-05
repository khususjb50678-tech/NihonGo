from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random, math, os, re
from pathlib import Path

ROOT=Path('/mnt/data/work600')
OUT=ROOT/'jft_jlpt_media'
OUT.mkdir(exist_ok=True)
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
font_b='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'

def F(size,bold=False): return ImageFont.truetype(font_b if bold else font,size)

def rr(d,box,r,fill,outline=None,w=1): d.rounded_rectangle(box,r,fill=fill,outline=outline,width=w)

def person(d,x,y,s,seed,role='person'):
    rnd=random.Random(seed)
    skin=rnd.choice(['#f2c7a5','#e7b58e','#d79a70','#f6d1b1'])
    shirt=rnd.choice(['#2f4f76','#7c3030','#3c6b50','#5c4b7a','#b37a2d','#d9d9d9'])
    # head
    d.ellipse((x-s*.22,y-s*.55,x+s*.22,y-s*.11),fill=skin,outline='#3a2a24',width=max(1,int(s*.02)))
    # hair
    d.arc((x-s*.22,y-s*.57,x+s*.22,y-s*.05),180,355,fill='#2b211c',width=max(2,int(s*.08)))
    # body
    d.rounded_rectangle((x-s*.38,y-s*.05,x+s*.38,y+s*.72),radius=int(s*.12),fill=shirt,outline='#222',width=max(1,int(s*.02)))
    # arms
    d.line((x-s*.28,y+s*.08,x-s*.52,y+s*.43),fill=shirt,width=max(3,int(s*.12)))
    d.line((x+s*.28,y+s*.08,x+s*.52,y+s*.43),fill=shirt,width=max(3,int(s*.12)))
    # legs
    d.line((x-s*.12,y+s*.70,x-s*.18,y+s*1.1),fill='#2d2d35',width=max(3,int(s*.11)))
    d.line((x+s*.12,y+s*.70,x+s*.18,y+s*1.1),fill='#2d2d35',width=max(3,int(s*.11)))

def draw_scene(idx, category):
    rnd=random.Random(100000+idx*7919)
    W,H=800,500
    im=Image.new('RGB',(W,H),(238,236,230)); d=ImageDraw.Draw(im)
    # soft sky/wall gradient bands
    top=rnd.choice(['#dbeaf4','#eee5d2','#e3eadf','#e9dfe8','#dfe4f1','#f1e3d8'])
    d.rectangle((0,0,W,290),fill=top)
    d.rectangle((0,290,W,H),fill=rnd.choice(['#c8b79d','#a9b8a1','#b6a58f','#9e9b96','#d0c1aa']))
    # light
    d.ellipse((40,30,220,210),fill=(255,255,255,45))
    # category-specific architecture/objects
    cat=category
    label={'station':'えき','supermarket':'スーパー','restaurant':'レストラン','school':'がっこう','office':'かいしゃ','hospital':'びょういん','bank':'ぎんこう','city':'まち','factory':'こうじょう','airport':'くうこう','meeting':'かいぎ','weather':'てんき'}.get(cat,cat)
    # header sign
    rr(d,(24,22,250,86),16,'#ffffff',outline='#777',w=2)
    d.text((45,40),label,font=F(28,True),fill='#252525')

    if cat=='station':
        d.rectangle((0,245,W,290),fill='#4c4e53')
        d.rectangle((60,150,740,220),fill='#f5f5f5',outline='#555',width=3)
        for x in range(90,730,80): d.line((x,150,x,220),fill='#777',width=2)
        d.rectangle((120,105,350,145),fill='#222')
        d.text((145,112),'8:30',font=F(22,True),fill='#ffd45a')
        d.rectangle((470,105,700,145),fill='#222'); d.text((500,112),'12:10',font=F(22,True),fill='#ffd45a')
        for j in range(2+rnd.randrange(3)): person(d,150+j*170+rnd.randrange(-30,30),300,75,idx*13+j)
        d.rectangle((0,410,W,500),fill='#35383c'); d.line((0,455,W,455),fill='#e4c65a',width=6)
    elif cat=='supermarket':
        d.rectangle((0,95,W,130),fill='#d84d4d'); d.text((50,99),'おかいもの',font=F(24,True),fill='white')
        for k,x in enumerate([70,270,470,650]):
            rr(d,(x,150,x+100,370),8,'#f8f8f8',outline='#777',w=2)
            for r in range(3):
                col=rnd.choice(['#e26d5c','#6ea86e','#e7b34a','#8ca8d6'])
                d.ellipse((x+15,175+r*55,x+50,210+r*55),fill=col)
                d.rectangle((x+55,175+r*55,x+88,210+r*55),fill=col)
        person(d,395,305,78,idx*11)
        d.rectangle((310,385,500,420),fill='#555'); d.text((330,389),'レジ',font=F(22,True),fill='white')
    elif cat=='restaurant':
        d.rectangle((70,120,730,150),fill='#8a3f35')
        for x in [120,300,480,660]:
            d.rectangle((x,210,x+100,235),fill='#7b4e32'); d.rectangle((x+45,235,x+55,380),fill='#5b3c2a')
            d.ellipse((x+15,185,x+85,235),fill='#f4f4f4',outline='#555')
            d.ellipse((x+35,198,x+65,228),fill=rnd.choice(['#e56b55','#6aa35d','#e0b54d']))
        person(d,420,300,82,idx*7)
        rr(d,(250,420,550,470),12,'#fff',outline='#8a3f35',w=3); d.text((300,428),'MENU',font=F(24,True),fill='#8a3f35')
    elif cat=='school':
        d.rectangle((80,105,720,370),fill='#e7d6a7',outline='#777',width=3)
        for x in [120,290,460,630]: d.rectangle((x,150,x+95,250),fill='#a7d3e6',outline='#555',width=3)
        d.rectangle((285,275,515,350),fill='#5c7c4d'); d.text((330,292),'にほんご',font=F(25,True),fill='white')
        for j in range(3): person(d,200+j*200,360,65,idx*9+j)
        d.rectangle((0,400,W,500),fill='#8d7a65')
    elif cat=='office':
        d.rectangle((50,110,750,145),fill='#566b83')
        for x in [90,300,510]:
            d.rectangle((x,220,x+180,255),fill='#7b5a43'); d.rectangle((x+25,255,x+155,360),fill='#f2f2f2',outline='#777')
        d.rectangle((300,145,500,200),fill='#222'); d.text((355,155),'10:15',font=F(25,True),fill='#bde7ff')
        for j in range(3): person(d,170+j*230,345,68,idx*5+j)
    elif cat=='hospital':
        d.rectangle((65,110,735,390),fill='#f6f6f6',outline='#6c7d86',width=3)
        d.rectangle((335,125,465,175),fill='#e35c5c'); d.text((370,132),'＋',font=F(36,True),fill='white')
        for x in [130,560]:
            d.rectangle((x,200,x+110,330),fill='#c9e6f1',outline='#667',width=3)
        person(d,400,300,82,idx*17)
        rr(d,(270,405,530,460),12,'#ffffff',outline='#a44',w=2); d.text((320,412),'うけつけ',font=F(23,True),fill='#a44')
    elif cat=='bank':
        d.rectangle((70,115,730,390),fill='#e8e4d9',outline='#666',width=3)
        d.polygon([(70,115),(400,55),(730,115)],fill='#516c75')
        for x in [130,320,510]: d.rectangle((x,210,x+120,335),fill='#6c8790')
        d.rectangle((270,155,530,205),fill='#fff'); d.text((345,165),'BANK',font=F(25,True),fill='#4a5c67')
        person(d,400,340,72,idx*19)
    elif cat=='city':
        for x in range(40,780,90):
            h=rnd.randrange(130,260); col=rnd.choice(['#8292a3','#b1a18e','#8e9f8b','#9b8799'])
            d.rectangle((x,330-h,x+65,330),fill=col,outline='#555')
            for yy in range(350-h,320,35):
                for xx in range(x+10,x+58,22): d.rectangle((xx,yy,xx+9,yy+15),fill='#f2d889')
        d.rectangle((0,330,W,500),fill='#45484b'); d.line((0,420,W,420),fill='#ddd',width=5)
        for j in range(2): person(d,220+j*360,345,65,idx*23+j)
    elif cat=='factory':
        d.rectangle((100,150,700,360),fill='#7f8b93',outline='#4d565c',width=3)
        for x in [160,330,500,620]: d.rectangle((x,210,x+80,300),fill='#c6d2d8',outline='#555')
        for x in [200,570]:
            d.rectangle((x,60,x+55,180),fill='#666');
            for k in range(3): d.ellipse((x-10,30-k*15,x+65,90-k*15),fill='#d9d9d9')
        person(d,390,335,70,idx*29)
    elif cat=='airport':
        d.rectangle((55,115,745,390),fill='#dce6ed',outline='#65737c',width=3)
        d.rectangle((80,165,720,205),fill='#263640'); d.text((120,171),'FLIGHT  12:40',font=F(22,True),fill='#d9f0a0')
        for x in [130,300,470,640]:
            d.rectangle((x,250,x+100,330),fill='#eef4f7',outline='#778')
            d.rectangle((x+15,265,x+85,285),fill='#a8c7d8')
        person(d,400,350,72,idx*31)
    elif cat=='meeting':
        d.ellipse((130,150,670,420),fill='#7d6048',outline='#4e3b2c',width=4)
        for j in range(5):
            ang=2*math.pi*j/5; x=400+260*math.cos(ang); y=285+135*math.sin(ang)
            person(d,int(x),int(y),62,idx*37+j)
        d.rectangle((335,235,465,280),fill='#222'); d.text((360,241),'MEETING',font=F(17,True),fill='#bde7ff')
    elif cat=='weather':
        sky=rnd.choice(['#9ec8e5','#c6d7e5','#e8cfa8']); d.rectangle((0,90,W,330),fill=sky)
        if idx%3==0:
            for x,y in [(180,160),(300,120),(520,150),(650,110)]: d.ellipse((x,y,x+120,y+60),fill='#eef2f5')
            d.ellipse((250,210,550,300),fill='#ffd45a')
        elif idx%3==1:
            for x,y in [(180,150),(360,120),(540,170)]:
                d.ellipse((x,y,x+100,y+55),fill='#7b8792'); d.ellipse((x+50,y-25,x+160,y+55),fill='#7b8792')
            for x in range(180,650,55): d.line((x,250,x-15,300),fill='#5d8ab2',width=3)
        else:
            for x,y in [(170,150),(360,120),(560,160)]:
                d.ellipse((x,y,x+110,y+60),fill='#bfc7cf'); d.ellipse((x+45,y-25,x+160,y+60),fill='#bfc7cf')
            for x in range(180,650,70): d.line((x,250,x+10,310),fill='white',width=5)
        person(d,400,350,70,idx*41)
    # extra foreground props vary by seed
    props=['バッグ','ほん','スマホ','かさ','みず','かばん','しょるい','ペン']
    for k in range(3):
        x=rnd.randrange(50,740); y=rnd.randrange(400,470)
        rr(d,(x,y,x+60,y+30),6,rnd.choice(['#6f4b3e','#4c6b5a','#6c5a7a','#b07a3d']),outline='#333')
        if rnd.random()<.55: d.text((x+6,y+3),rnd.choice(props),font=F(12),fill='white')
    # title footer to distinguish variants
    rr(d,(20,440,780,485),12,'#ffffffcc',outline='#777',w=1)
    d.text((40,449),f'{label}  •  scene {idx:03d}',font=F(20,True),fill='#252525')
    # subtle blur then sharpen for polished look
    im=im.filter(ImageFilter.GaussianBlur(0.35))
    im=im.filter(ImageFilter.UnsharpMask(radius=1,percent=100,threshold=2))
    return im

# read existing SQL photo category for each question
sql=(ROOT/'FINAL-JFT-JLPT-ALL.sql').read_text(encoding='utf8')
lines=[l for l in sql.splitlines() if l.startswith('insert into questions')]
catmap={
 '01_station.png':'station','02_supermarket.png':'supermarket','03_restaurant.png':'restaurant','04_school.png':'school',
 '05_office.png':'office','06_hospital.png':'hospital','07_bank.png':'bank','08_city.png':'city','09_factory.png':'factory',
 '10_airport.png':'airport','11_meeting.png':'meeting','12_weather.png':'weather'}
new=[]
for i,l in enumerate(lines,1):
    old=re.search(r",'([^']+\.png)',NULL,'",l)
    cat=catmap.get(old.group(1),'city') if old else 'city'
    fn=f'q{i:03d}.jpg'
    draw_scene(i,cat).save(OUT/fn,quality=84,optimize=True)
    new.append((i,cat,fn,l.replace(old.group(1),fn) if old else l))
# rewrite all question photo refs to unique files
it=iter(new)
for i,cat,fn,l in new:
    pass
out=[]
for l in sql.splitlines():
    if l.startswith('insert into questions'):
        # sequential
        i=len([x for x in out if x.startswith('insert into questions')])+1
        old=re.search(r",'([^']+\.png)',NULL,'",l)
        if old:
            l=l.replace(old.group(1),f'q{i:03d}.jpg')
    out.append(l)
(ROOT/'FINAL-JFT-JLPT-ALL.sql').write_text('\n'.join(out)+'\n',encoding='utf8')
print('generated',len(lines),'unique images at',OUT)
