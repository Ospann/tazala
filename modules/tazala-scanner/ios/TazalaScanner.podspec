Pod::Spec.new do |s|
  s.name           = 'TazalaScanner'
  s.version        = '0.1.0'
  s.summary        = 'On-device photo library scanner for Tazala'
  s.description    = 'Scans, analyzes and deletes assets from the device photo library. Nothing leaves the device.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Photos', 'PhotosUI', 'Vision', 'Accelerate'
  s.library = 'sqlite3'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'Core/**/*.swift', 'Module/**/*.swift'
end
