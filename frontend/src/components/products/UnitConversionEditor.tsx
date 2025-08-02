import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

interface UnitConversion {
  unit: string;
  quantity: number;
}

interface UnitConversionEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const UnitConversionEditor: React.FC<UnitConversionEditorProps> = ({ value, onChange }) => {
  const [conversions, setConversions] = useState<UnitConversion[]>([]);

  // Parse JSON value to conversions array
  useEffect(() => {
    console.log('UnitConversionEditor received value:', value);
    try {
      if (value && value.trim()) {
        const parsed = JSON.parse(value);
        console.log('Parsed unit conversions:', parsed);
        if (typeof parsed === 'object' && parsed !== null) {
          const conversionArray = Object.entries(parsed).map(([unit, quantity]) => ({
            unit,
            quantity: Number(quantity)
          }));
          console.log('Conversion array:', conversionArray);
          setConversions(conversionArray);
        } else {
          setConversions([]);
        }
      } else {
        setConversions([]);
      }
    } catch (error) {
      console.error('Error parsing unit conversions:', error);
      setConversions([]);
    }
  }, [value]);

  // Convert conversions array back to JSON string
  const updateValue = (newConversions: UnitConversion[]) => {
    const conversionObject = newConversions.reduce((acc, conv) => {
      if (conv.unit.trim() && conv.quantity > 0) {
        acc[conv.unit.trim()] = conv.quantity;
      }
      return acc;
    }, {} as Record<string, number>);
    
    onChange(JSON.stringify(conversionObject, null, 2));
  };

  const addConversion = () => {
    const newConversions = [...conversions, { unit: '', quantity: 1 }];
    setConversions(newConversions);
    updateValue(newConversions);
  };

  const removeConversion = (index: number) => {
    const newConversions = conversions.filter((_, i) => i !== index);
    setConversions(newConversions);
    updateValue(newConversions);
  };

  const updateConversion = (index: number, field: 'unit' | 'quantity', value: string | number) => {
    const newConversions = [...conversions];
    newConversions[index] = {
      ...newConversions[index],
      [field]: field === 'quantity' ? Number(value) || 0 : value
    };
    setConversions(newConversions);
    updateValue(newConversions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Unit Conversions</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addConversion}
          className="flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Conversion
        </Button>
      </div>
      
      {conversions.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground border rounded-md">
          No unit conversions defined. Click "Add Conversion" to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {conversions.map((conversion, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-md">
              <div className="flex-1">
                <Label htmlFor={`unit-${index}`} className="text-xs text-muted-foreground">
                  Unit Name
                </Label>
                <Input
                  id={`unit-${index}`}
                  placeholder="e.g., Box, Carton, Pack"
                  value={conversion.unit}
                  onChange={(e) => updateConversion(index, 'unit', e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">=</span>
              </div>
              
              <div className="flex-1">
                <Label htmlFor={`quantity-${index}`} className="text-xs text-muted-foreground">
                  Quantity (in base units)
                </Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min="1"
                  placeholder="12"
                  value={conversion.quantity}
                  onChange={(e) => updateConversion(index, 'quantity', e.target.value)}
                />
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeConversion(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        <p>Example: 1 Box = 12 units, 1 Carton = 24 units</p>
        <p>This helps with inventory management and sales calculations.</p>
      </div>
    </div>
  );
}; 