import AppKit
let args = CommandLine.arguments
guard args.count > 1, let url = URL(fileURLWithPath: args[1]) as CFURL?,
      let src = CGImageSourceCreateWithURL(url, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(2) }
let w = img.width, h = img.height
let cs = CGColorSpaceCreateDeviceRGB()
var buf = [UInt8](repeating: 0, count: w*h*4)
let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8,
                    bytesPerRow: w*4, space: cs,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)
guard let ctx = ctx else { exit(3) }
ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
var out = "\(w) \(h)\n"
for y in 0..<h {
    var line = ""
    for x in 0..<w {
        let i = (y*w+x)*4
        line += String(format: "%d,%d,%d,%d ", buf[i], buf[i+1], buf[i+2], buf[i+3])
    }
    out += line + "\n"
}
FileHandle.standardOutput.write(out.data(using: .utf8)!)
