// Renderiza un QR como imagen (GIF data-URI) usando qrcode-generator (JS puro,
// sin módulo nativo → viaja por OTA). React Native muestra GIF por data-URI.
import { Image, View, Text } from 'react-native';
// @ts-ignore — qrcode-generator no trae tipos; su default export es una función
import qrcode from 'qrcode-generator';

interface Props { value: string; size?: number }

export default function QrImage({ value, size = 200 }: Props) {
  if (!value) return null;
  let uri = '';
  try {
    const qr = qrcode(0, 'M');   // tipo auto, corrección de error M
    qr.addData(value);
    qr.make();
    uri = qr.createDataURL(4, 8); // cellSize 4px, margen 8
  } catch {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#90A4AE', fontSize: 11, textAlign: 'center' }}>No se pudo generar el QR</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />;
}
