import AppKit
import CoreGraphics
import Foundation

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
  CGColor(
    red: CGFloat((hex >> 16) & 0xff) / 255,
    green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255,
    alpha: alpha
  )
}

func save(_ context: CGContext, _ path: String) {
  let rep = NSBitmapImageRep(cgImage: context.makeImage()!)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

func makeContext(_ size: Int) -> CGContext {
  CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}

func sparkle(_ context: CGContext, center: CGPoint, radius: CGFloat, waist: CGFloat, fill: CGColor) {
  let path = CGMutablePath()
  let points = (0..<4).map { index -> CGPoint in
    let angle = CGFloat(index) * .pi / 2
    return CGPoint(x: center.x + cos(angle) * radius, y: center.y + sin(angle) * radius)
  }
  path.move(to: points[0])
  for index in 0..<4 {
    let next = points[(index + 1) % 4]
    let control = CGPoint(x: center.x + (cos(CGFloat(index) * .pi / 2 + .pi / 4)) * radius * waist,
                          y: center.y + (sin(CGFloat(index) * .pi / 2 + .pi / 4)) * radius * waist)
    path.addQuadCurve(to: next, control: control)
  }
  path.closeSubpath()
  context.addPath(path)
  context.setFillColor(fill)
  context.fillPath()
}

func photoCard(_ context: CGContext, rect: CGRect, angle: CGFloat, background: CGColor, withScene: Bool, shadow: Bool) {
  context.saveGState()
  context.translateBy(x: rect.midX, y: rect.midY)
  context.rotate(by: angle)
  let local = CGRect(x: -rect.width / 2, y: -rect.height / 2, width: rect.width, height: rect.height)
  let radius = rect.width * 0.11
  if shadow {
    context.setShadow(offset: CGSize(width: 0, height: -rect.width * 0.04), blur: rect.width * 0.12, color: color(0x03322C, 0.35))
  }
  context.addPath(CGPath(roundedRect: local, cornerWidth: radius, cornerHeight: radius, transform: nil))
  context.setFillColor(background)
  context.fillPath()
  context.setShadow(offset: .zero, blur: 0, color: nil)

  if withScene {
    let inset = rect.width * 0.075
    let photo = local.insetBy(dx: inset, dy: inset)
    let innerRadius = radius * 0.6
    context.saveGState()
    context.addPath(CGPath(roundedRect: photo, cornerWidth: innerRadius, cornerHeight: innerRadius, transform: nil))
    context.clip()
    let sky = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [color(0xD7F6F0), color(0x9FE7DA)] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(sky, start: CGPoint(x: photo.midX, y: photo.minY), end: CGPoint(x: photo.midX, y: photo.maxY), options: [])
    let sunRadius = photo.width * 0.13
    context.setFillColor(color(0xFF8A7A))
    context.fillEllipse(in: CGRect(x: photo.maxX - photo.width * 0.32 - sunRadius, y: photo.maxY - photo.height * 0.30 - sunRadius, width: sunRadius * 2, height: sunRadius * 2))
    let back = CGMutablePath()
    back.move(to: CGPoint(x: photo.minX, y: photo.minY + photo.height * 0.30))
    back.addLine(to: CGPoint(x: photo.minX + photo.width * 0.62, y: photo.minY + photo.height * 0.66))
    back.addLine(to: CGPoint(x: photo.maxX, y: photo.minY + photo.height * 0.36))
    back.addLine(to: CGPoint(x: photo.maxX, y: photo.minY))
    back.addLine(to: CGPoint(x: photo.minX, y: photo.minY))
    back.closeSubpath()
    context.addPath(back)
    context.setFillColor(color(0x2CC7B2))
    context.fillPath()
    let front = CGMutablePath()
    front.move(to: CGPoint(x: photo.minX, y: photo.minY + photo.height * 0.50))
    front.addLine(to: CGPoint(x: photo.minX + photo.width * 0.30, y: photo.minY + photo.height * 0.74))
    front.addLine(to: CGPoint(x: photo.minX + photo.width * 0.72, y: photo.minY + photo.height * 0.24))
    front.addLine(to: CGPoint(x: photo.maxX, y: photo.minY + photo.height * 0.12))
    front.addLine(to: CGPoint(x: photo.maxX, y: photo.minY))
    front.addLine(to: CGPoint(x: photo.minX, y: photo.minY))
    front.closeSubpath()
    context.addPath(front)
    context.setFillColor(color(0x0B7D70))
    context.fillPath()
    context.restoreGState()
  }
  context.restoreGState()
}

func drawIcon(_ context: CGContext, side: CGFloat, transparentBackground: Bool, scale: CGFloat, shadow: Bool = true) {
  if !transparentBackground {
    let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [color(0x18C2AB), color(0x08695F)] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: side), end: CGPoint(x: side, y: 0), options: [])
    let glow = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [color(0xFFFFFF, 0.28), color(0xFFFFFF, 0)] as CFArray, locations: [0, 1])!
    context.drawRadialGradient(glow, startCenter: CGPoint(x: side * 0.28, y: side * 0.82), startRadius: 0, endCenter: CGPoint(x: side * 0.28, y: side * 0.82), endRadius: side * 0.65, options: [])
  }
  context.saveGState()
  context.translateBy(x: side / 2, y: side / 2)
  context.scaleBy(x: scale, y: scale)
  context.translateBy(x: -side / 2, y: -side / 2)

  let cardSize = CGSize(width: side * 0.50, height: side * 0.56)
  let center = CGPoint(x: side * 0.47, y: side * 0.45)
  photoCard(context, rect: CGRect(x: center.x - cardSize.width / 2 - side * 0.05, y: center.y - cardSize.height / 2 + side * 0.035, width: cardSize.width, height: cardSize.height),
            angle: 0.24, background: color(0xFFFFFF, 0.38), withScene: false, shadow: false)
  photoCard(context, rect: CGRect(x: center.x - cardSize.width / 2, y: center.y - cardSize.height / 2, width: cardSize.width, height: cardSize.height),
            angle: -0.12, background: color(0xFFFFFF), withScene: true, shadow: shadow)

  sparkle(context, center: CGPoint(x: side * 0.73, y: side * 0.74), radius: side * 0.135, waist: 0.2, fill: color(0xFFFFFF))
  sparkle(context, center: CGPoint(x: side * 0.86, y: side * 0.56), radius: side * 0.06, waist: 0.22, fill: color(0xFFD2CB))
  sparkle(context, center: CGPoint(x: side * 0.60, y: side * 0.88), radius: side * 0.045, waist: 0.22, fill: color(0xFFFFFF, 0.9))
  context.restoreGState()
}

let out = CommandLine.arguments[1]

let icon = makeContext(1024)
drawIcon(icon, side: 1024, transparentBackground: false, scale: 1)
save(icon, "\(out)/icon.png")

let background = makeContext(1024)
let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [color(0x18C2AB), color(0x08695F)] as CFArray, locations: [0, 1])!
background.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 1024), end: CGPoint(x: 1024, y: 0), options: [])
save(background, "\(out)/android-icon-background.png")

let foreground = makeContext(1024)
drawIcon(foreground, side: 1024, transparentBackground: true, scale: 0.64)
save(foreground, "\(out)/android-icon-foreground.png")

let monochromeSource = makeContext(1024)
drawIcon(monochromeSource, side: 1024, transparentBackground: true, scale: 0.64, shadow: false)
let sourceImage = monochromeSource.makeImage()!
let width = sourceImage.width, height = sourceImage.height
var pixels = [UInt8](repeating: 0, count: width * height * 4)
let pixelContext = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                             space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
pixelContext.draw(sourceImage, in: CGRect(x: 0, y: 0, width: width, height: height))
for index in stride(from: 0, to: pixels.count, by: 4) {
  let alpha = Double(pixels[index + 3]) / 255
  guard alpha > 0 else { continue }
  let luminance = (0.299 * Double(pixels[index]) + 0.587 * Double(pixels[index + 1]) + 0.114 * Double(pixels[index + 2])) / 255 / alpha
  let value = alpha * pow(min(max((luminance - 0.35) / 0.65, 0), 1), 1.4)
  let byte = UInt8(max(0, min(255, value * 255)))
  pixels[index] = byte
  pixels[index + 1] = byte
  pixels[index + 2] = byte
  pixels[index + 3] = byte
}
save(pixelContext, "\(out)/android-icon-monochrome.png")

let splash = makeContext(512)
drawIcon(splash, side: 512, transparentBackground: false, scale: 1)
let splashMask = makeContext(512)
splashMask.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: 512, height: 512), cornerWidth: 115, cornerHeight: 115, transform: nil))
splashMask.clip()
splashMask.draw(splash.makeImage()!, in: CGRect(x: 0, y: 0, width: 512, height: 512))
save(splashMask, "\(out)/splash-icon.png")
print("ok")
