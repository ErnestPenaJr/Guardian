import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const StyleGuide: React.FC = () => {
  const [formState, setFormState] = useState({
    checkbox1: true,
    checkbox2: false,
    checkbox3: false,
    radio: "option1",
    toggle1: true,
    toggle2: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-secondary hover:text-secondary/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Login</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-8 h-8" />
          <h1 className="text-h3 font-display font-bold text-primary">Guardian Style Guide</h1>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Colors Section */}
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-h5 font-display font-bold text-primary mb-6">01. Colors</h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-body-md font-semibold mb-4">Brand Colors</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="h-36 w-full rounded-md mb-2" style={{ backgroundColor: '#032424' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Primary</p>
                      <p className="text-body-xs text-gray-3">#032424</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-36 w-full rounded-md mb-2" style={{ backgroundColor: '#2EBCBC' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Secondary</p>
                      <p className="text-body-xs text-gray-3">#2EBCBC</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-body-md font-semibold mb-4">State Colors</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#2F8CED' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Info</p>
                      <p className="text-body-xs text-gray-3">#2F8CED</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#27AE60' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Success</p>
                      <p className="text-body-xs text-gray-3">#27AE60</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#E2B93B' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Warning</p>
                      <p className="text-body-xs text-gray-3">#E2B93B</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#C10000' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Error</p>
                      <p className="text-body-xs text-gray-3">#C10000</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-body-md font-semibold mb-4">Black Colors</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#000000' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Black 1</p>
                      <p className="text-body-xs text-gray-3">#000000</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#1F1F1F' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Black 2</p>
                      <p className="text-body-xs text-gray-3">#1F1F1F</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: '#282828' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">Black 3</p>
                      <p className="text-body-xs text-gray-3">#282828</p>
                    </div>
                  </div>
                  <div>
                    <div className="h-16 w-16 bg-white border border-gray-5 rounded-md mb-2" style={{ backgroundColor: '#FFFFFF' }}></div>
                    <div className="mt-2">
                      <p className="text-body-sm font-medium">White</p>
                      <p className="text-body-xs text-gray-3">#FFFFFF</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-body-md font-semibold mb-4">Grey Colors</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  {[
                    { num: 1, hex: '#4F4F4F' },
                    { num: 2, hex: '#6F6F6F' },
                    { num: 3, hex: '#828282' },
                    { num: 4, hex: '#BDBDBD' },
                    { num: 5, hex: '#E0E0E0' }
                  ].map((item) => (
                    <div key={item.num}>
                      <div className="h-16 w-16 rounded-md mb-2" style={{ backgroundColor: item.hex }}></div>
                      <div className="mt-2">
                        <p className="text-body-sm font-medium">Gray {item.num}</p>
                        <p className="text-body-xs text-gray-3">{item.hex}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Typography Section */}
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-h5 font-display font-bold text-primary mb-6">02. Typography</h2>
            
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3">
                  <div className="text-gray-3 text-[120px] font-display font-bold leading-none">Aa</div>
                  <h3 className="text-h5 text-gray-1 mt-2">Heading</h3>
                  <p className="text-body-xs text-gray-3 mt-1">Line height and paragraph spacing for heading is: 1.1 × font size</p>
                </div>
                
                <div className="md:w-2/3">
                  <div className="mb-6">
                    <h3 className="text-h5 text-center mb-4">Montserrat</h3>
                    <p className="text-body-xs text-gray-3 text-center">Google Fonts</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div className="text-body-sm font-medium">Name</div>
                    <div className="text-body-sm font-medium">Font size</div>
                    <div className="text-body-sm font-medium">Line Height</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-h5 font-bold">Heading 1</div>
                      <div className="text-body-sm">56 px</div>
                      <div className="text-body-sm">61.6 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-h5 font-semibold">Heading 2</div>
                      <div className="text-body-sm">48 px</div>
                      <div className="text-body-sm">52.8 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-h5 font-medium">Heading 3</div>
                      <div className="text-body-sm">40 px</div>
                      <div className="text-body-sm">44 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-h5 font-normal">Heading 4</div>
                      <div className="text-body-sm">32 px</div>
                      <div className="text-body-sm">35.2 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-md font-medium">Heading 5</div>
                      <div className="text-body-sm">24 px</div>
                      <div className="text-body-sm">26.4 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-sm font-medium">Heading 6</div>
                      <div className="text-body-sm">20 px</div>
                      <div className="text-body-sm">22 px</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-8 mt-12">
                <div className="md:w-1/3">
                  <div className="text-gray-3 text-[120px] font-sans font-bold leading-none">Aa</div>
                  <h3 className="text-h5 text-gray-1 mt-2">Body</h3>
                  <p className="text-body-xs text-gray-3 mt-1">Line height and paragraph spacing for body text is: 1.4 × font size</p>
                </div>
                
                <div className="md:w-2/3">
                  <div className="mb-6">
                    <h3 className="text-h5 text-center mb-4">Inter</h3>
                    <p className="text-body-xs text-gray-3 text-center">Google Fonts</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div className="text-body-sm font-medium">Name</div>
                    <div className="text-body-sm font-medium">Font size</div>
                    <div className="text-body-sm font-medium">Line Height</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-lg font-bold">Large Text Bold</div>
                      <div className="text-body-sm">20 px</div>
                      <div className="text-body-sm">28 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-lg font-normal">Large Text Regular</div>
                      <div className="text-body-sm">20 px</div>
                      <div className="text-body-sm">28 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-md font-bold">Medium Text Bold</div>
                      <div className="text-body-sm">18 px</div>
                      <div className="text-body-sm">25.2 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-md font-normal">Medium Text Regular</div>
                      <div className="text-body-sm">18 px</div>
                      <div className="text-body-sm">25.2 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-base font-bold">Normal Text Bold</div>
                      <div className="text-body-sm">16 px</div>
                      <div className="text-body-sm">22.4 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-base font-normal">Normal Text Regular</div>
                      <div className="text-body-sm">16 px</div>
                      <div className="text-body-sm">22.4 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-sm font-bold">Small Text Bold</div>
                      <div className="text-body-sm">14 px</div>
                      <div className="text-body-sm">19.6 px</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-body-sm font-normal">Small Text Regular</div>
                      <div className="text-body-sm">14 px</div>
                      <div className="text-body-sm">19.6 px</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Buttons Section */}
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-h5 font-display font-bold text-primary mb-6">03. Buttons</h2>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-start gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-gray-3 flex items-center justify-center text-white text-xs">i</div>
                    <div>
                      <p className="text-body-sm font-semibold">Button Rules:</p>
                      <p className="text-body-xs text-gray-3">Padding Left/Right → 2 × font size</p>
                      <p className="text-body-xs text-gray-3">Padding Top/Bottom → 1 × font size</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-start gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-gray-3 flex items-center justify-center text-white text-xs">i</div>
                    <div>
                      <p className="text-body-sm font-semibold">Full-width Button:</p>
                      <p className="text-body-xs text-gray-3">Left/Right → determined by the device width</p>
                      <p className="text-body-xs text-gray-3">Top/Bottom → 1 × font size</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Color</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-body-sm mb-2">Primary</p>
                      <button 
                        className="bg-primary text-white font-semibold py-3 px-6 transition-colors duration-200" 
                        style={{ 
                          borderRadius: '6px',
                          backgroundColor: '#032424'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#021818'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#032424'}
                      >
                        Button Sample
                      </button>
                    </div>
                    
                    <div>
                      <p className="text-body-sm mb-2">Secondary</p>
                      <button 
                        className="bg-secondary text-white font-semibold py-3 px-6 transition-colors duration-200" 
                        style={{ 
                          borderRadius: '6px',
                          backgroundColor: '#2EBCBC'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#24A5A5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2EBCBC'}
                      >
                        Button Sample
                      </button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Size</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-body-sm mb-2">Small</p>
                      <button 
                        className="bg-primary text-white font-semibold py-2 px-4 text-body-sm transition-colors duration-200" 
                        style={{ 
                          borderRadius: '6px',
                          backgroundColor: '#032424'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#021818'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#032424'}
                      >
                        Button Sample
                      </button>
                    </div>
                    
                    <div>
                      <p className="text-body-sm mb-2">Normal</p>
                      <button 
                        className="bg-primary text-white font-semibold py-3 px-6 transition-colors duration-200" 
                        style={{ 
                          borderRadius: '6px',
                          backgroundColor: '#032424'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#021818'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#032424'}
                      >
                        Button Sample
                      </button>
                    </div>
                    
                    <div>
                      <p className="text-body-sm mb-2">Medium</p>
                      <button 
                        className="bg-primary text-white font-semibold py-3 px-8 transition-colors duration-200" 
                        style={{ 
                          borderRadius: '6px',
                          backgroundColor: '#032424'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#021818'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#032424'}
                      >
                        Button Sample
                      </button>
                    </div>
                    
                    <div>
                      <p className="text-body-sm mb-2">Large</p>
                      <button 
                        className="bg-primary text-white font-semibold py-4 px-10 transition-colors duration-200" 
                        style={{ 
                          borderRadius: '6px',
                          backgroundColor: '#032424'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#021818'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#032424'}
                      >
                        Button Sample
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Textfields Section */}
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-h5 font-display font-bold text-primary mb-6">04. Textfields</h2>
            
            <div className="space-y-8">
              <div className="bg-gray-50 p-4 rounded-md max-w-md">
                <div className="flex items-start gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-gray-3 flex items-center justify-center text-white text-xs">i</div>
                  <div>
                    <p className="text-body-sm font-semibold">Input Rules:</p>
                    <p className="text-body-xs text-gray-3">Padding Left/Right → 2 × font size</p>
                    <p className="text-body-xs text-gray-3">Padding Top/Bottom → 1 × font size</p>
                    <p className="text-body-xs text-gray-3">Padding Bottom(icon) → 3 × font size</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-body-md font-semibold mb-4">Label, Status & Placeholder</h3>
                <div className="max-w-xs">
                  <label className="block text-body-sm mb-1">Label</label>
                  <input 
                    type="text" 
                    placeholder="Placeholder" 
                    className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                  />
                  <p className="text-body-xs text-gray-3 mt-1">Status</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input Form ( No label & Status )</h3>
                  <input 
                    type="text" 
                    value="Input Text" 
                    className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                </div>
                
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input Form + Status ( No label )</h3>
                  <input 
                    type="text" 
                    value="Input Text" 
                    className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                  <p className="text-body-xs text-gray-3 mt-1">Status</p>
                </div>
                
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input State</h3>
                  <input 
                    type="text" 
                    value="Input Text" 
                    className="w-full px-4 py-3 border border-success focus:outline-none focus:ring-2 focus:ring-success focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                  <p className="text-body-xs text-success mt-1">Success !</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input Form + Label</h3>
                  <label className="block text-body-sm mb-1">Label Sample</label>
                  <input 
                    type="text" 
                    value="Input text" 
                    className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                </div>
                
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input Form + Label & Status</h3>
                  <label className="block text-body-sm mb-1">Label Sample</label>
                  <input 
                    type="text" 
                    value="Input Text Here" 
                    className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                  <p className="text-body-xs text-gray-3 mt-1">Empty</p>
                </div>
                
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input State</h3>
                  <input 
                    type="text" 
                    value="Input Text" 
                    className="w-full px-4 py-3 border border-warning focus:outline-none focus:ring-2 focus:ring-warning focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                  <p className="text-body-xs text-warning mt-1">Warning !</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input Icon + Label + Status</h3>
                  <label className="block text-body-sm mb-1">Label Sample</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value="Input Text icon" 
                      className="w-full px-4 py-3 pl-10 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                      style={{ borderRadius: '6px' }}
                      readOnly
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-body-xs text-gray-3 mt-1">Status</p>
                </div>
                
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Text Area</h3>
                  <label className="block text-body-sm mb-1">Label Sample</label>
                  <textarea 
                    className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    rows={5}
                    placeholder="Enter Text Here"
                  ></textarea>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-body-sm font-semibold mb-4">Input State</h3>
                  <input 
                    type="text" 
                    value="Input Text" 
                    className="w-full px-4 py-3 border border-error focus:outline-none focus:ring-2 focus:ring-error focus:border-transparent transition-all"
                    style={{ borderRadius: '6px' }}
                    readOnly
                  />
                  <p className="text-body-xs text-error mt-1">Error !</p>
                </div>
              </div>
            </div>
          </section>

          {/* Selectors Section */}
          <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-h5 font-display font-bold text-primary mb-6">05. Selectors</h2>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Dropdown</h3>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <select className="w-full px-4 py-3 rounded-lg border border-gray-5 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all pr-10">
                        <option>Dropdown</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <select className="w-full px-4 py-3 rounded-lg border border-gray-5 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all pr-10">
                        <option>Dropdown</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>
                    </div>
                    
                    <div className="border border-gray-5 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 hover:bg-gray-50">Option 1</div>
                      <div className="px-4 py-3 bg-primary text-white">Option 2</div>
                      <div className="px-4 py-3 hover:bg-gray-50">Option 3</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Checkbox</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="checkbox1"
                        checked={formState.checkbox1} 
                        onChange={handleChange}
                        className="w-5 h-5 rounded text-primary focus:ring-primary" 
                      />
                      <label className="ml-2 text-body-sm">Checkbox</label>
                    </div>
                    
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="checkbox2"
                        checked={formState.checkbox2}
                        onChange={handleChange}
                        className="w-5 h-5 rounded text-primary focus:ring-primary" 
                      />
                      <label className="ml-2 text-body-sm">Checkbox</label>
                    </div>
                    
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="checkbox3"
                        checked={formState.checkbox3}
                        onChange={handleChange}
                        className="w-5 h-5 rounded text-primary focus:ring-primary" 
                      />
                      <label className="ml-2 text-body-sm">Checkbox</label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Radio Button</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="radio"
                        value="option1"
                        checked={formState.radio === "option1"} 
                        onChange={handleChange}
                        className="w-5 h-5 text-primary focus:ring-primary" 
                      />
                      <label className="ml-2 text-body-sm">Radio Button</label>
                    </div>
                    
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="radio"
                        value="option2"
                        checked={formState.radio === "option2"}
                        onChange={handleChange}
                        className="w-5 h-5 text-primary focus:ring-primary" 
                      />
                      <label className="ml-2 text-body-sm">Radio Button</label>
                    </div>
                    
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="radio"
                        value="option3"
                        checked={formState.radio === "option3"}
                        onChange={handleChange}
                        className="w-5 h-5 text-primary focus:ring-primary" 
                      />
                      <label className="ml-2 text-body-sm">Radio Button</label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Toggle</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="toggle1"
                          checked={formState.toggle1}
                          onChange={handleChange}
                          id="toggle1" 
                          className="sr-only peer" 
                        />
                        <div className="w-10 h-6 bg-gray-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-5 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </div>
                      <label htmlFor="toggle1" className="text-body-sm">Toggle ON</label>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="toggle2"
                          checked={formState.toggle2}
                          onChange={handleChange}
                          id="toggle2" 
                          className="sr-only peer" 
                        />
                        <div className="w-10 h-6 bg-gray-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-5 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </div>
                      <label htmlFor="toggle2" className="text-body-sm">Toggle OFF</label>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <h3 className="text-body-md font-semibold mb-4">Large Selectors</h3>
                  
                  <div className="space-y-4">
                    <div className="border border-gray-5 rounded-lg p-4 bg-primary text-white text-center">
                      <p>No Additions</p>
                    </div>
                    
                    <div className="border border-gray-5 rounded-lg p-4 text-center">
                      <p className="text-gray-3">No Additions</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Pagination</h3>
                  
                  <div className="flex">
                    <button className="px-3 py-1 bg-primary text-white rounded-md">1</button>
                    <button className="px-3 py-1 text-gray-3 hover:bg-gray-50 rounded-md">2</button>
                    <button className="px-3 py-1 text-gray-3 hover:bg-gray-50 rounded-md">3</button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Breadcrumbs</h3>
                  
                  <div className="flex items-center text-body-sm">
                    <span className="text-gray-3">Home</span>
                    <svg className="w-4 h-4 mx-2 text-gray-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                    <span className="text-gray-3">Detail</span>
                    <svg className="w-4 h-4 mx-2 text-gray-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                    <span className="text-primary">Pricing</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-body-md font-semibold mb-4">Tabs</h3>
                  
                  <div className="border-b border-gray-5">
                    <div className="flex">
                      <button className="py-2 px-4 border-b-2 border-primary text-primary">Section 1</button>
                      <button className="py-2 px-4 text-gray-3">Section 2</button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-body-md font-semibold mb-4">Date Picker</h3>
                
                <div className="max-w-xs border border-gray-5 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <p className="font-medium">August 2025</p>
                    <div className="flex">
                      <button className="p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                      </button>
                      <button className="p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                    <div>S</div>
                    <div>M</div>
                    <div>T</div>
                    <div>W</div>
                    <div>T</div>
                    <div>F</div>
                    <div>S</div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    <div className="py-1">1</div>
                    <div className="py-1">2</div>
                    <div className="py-1">3</div>
                    <div className="py-1">4</div>
                    <div className="py-1">5</div>
                    <div className="py-1">6</div>
                    <div className="py-1">7</div>
                    <div className="py-1">8</div>
                    <div className="py-1 bg-primary text-white rounded-full">9</div>
                    <div className="py-1">10</div>
                    <div className="py-1">11</div>
                    <div className="py-1">12</div>
                    <div className="py-1">13</div>
                    <div className="py-1">14</div>
                    <div className="py-1">15</div>
                    <div className="py-1">16</div>
                    <div className="py-1">17</div>
                    <div className="py-1">18</div>
                    <div className="py-1">19</div>
                    <div className="py-1">20</div>
                    <div className="py-1">21</div>
                    <div className="py-1">22</div>
                    <div className="py-1">23</div>
                    <div className="py-1">24</div>
                    <div className="py-1">25</div>
                    <div className="py-1">26</div>
                    <div className="py-1">27</div>
                    <div className="py-1">28</div>
                    <div className="py-1">29</div>
                    <div className="py-1">30</div>
                    <div className="py-1">31</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StyleGuide;
