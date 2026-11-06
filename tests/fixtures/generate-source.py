"""Generate the synthetic H.264/AAC fixture used by real-browser export checks.

No merchant content. Requires ffmpeg with libx264 and AAC encoders.
The central crop contains known 4px black/white bars; a white box moves below it.
"""
from pathlib import Path
import subprocess
output = Path(__file__).with_name('source-detail.mp4')
pattern = "if(between(Y,600,659)*gte(X,60+mod(N*4,200))*lt(X,200+mod(N*4,200)),235,if(lt(mod(X,8),4),16,235))"
video = f"color=c=white:s=1280x720:r=30:d=1.2,geq=lum='{pattern}':cb=128:cr=128"
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', video,
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1.2',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-g', '30', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', str(output)
], check=True)
print(output)
