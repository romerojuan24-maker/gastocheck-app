import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../../lib/supabase'

interface FileUploaderProps {
  movementId: string
  onFileUploaded: (fileUrl: string, fileName: string) => void
  onError?: (error: string) => void
}

export function FileUploader({ movementId, onFileUploaded, onError }: FileUploaderProps) {
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<{ name: string; uri: string }[]>([])

  const pickDocument = async () => {
    try {
      setLoading(true)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/xml', 'text/xml'],
        copyToCacheDirectory: true,
      })

      if (result.canceled) {
        setLoading(false)
        return
      }

      const asset = result.assets[0]
      if (!asset) return

      // Validate file type
      const validTypes = ['.pdf', '.xml']
      const fileExtension = asset.name.substring(asset.name.lastIndexOf('.')).toLowerCase()
      if (!validTypes.includes(fileExtension)) {
        throw new Error('Solo se permiten archivos PDF o XML')
      }

      // Validate file size (max 10MB)
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        throw new Error('El archivo no debe exceder 10MB')
      }

      await uploadFile(asset.uri, asset.name)
    } catch (err: any) {
      const errorMsg = err.message || 'Error al seleccionar archivo'
      Alert.alert('Error', errorMsg)
      onError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (uri: string, fileName: string) => {
    try {
      setLoading(true)

      // Read file as base64
      const response = await fetch(uri)
      const blob = await response.blob()

      // Generate unique file path
      const timestamp = new Date().getTime()
      const fileKey = `movements/${movementId}/${timestamp}_${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('cobra_documents')
        .upload(fileKey, blob, {
          contentType: blob.type,
          upsert: false,
        })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('cobra_documents')
        .getPublicUrl(fileKey)

      const fileUrl = urlData.publicUrl

      // Add to local list
      setFiles([...files, { name: fileName, uri: fileUrl }])

      // Notify parent
      onFileUploaded(fileUrl, fileName)

      Alert.alert('Éxito', `${fileName} subido correctamente`)
    } catch (err: any) {
      const errorMsg = err.message || 'Error al subir archivo'
      Alert.alert('Error', errorMsg)
      onError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
        onPress={pickDocument}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadText}>Subir PDF/XML</Text>
          </>
        )}
      </TouchableOpacity>

      {files.length > 0 && (
        <View style={styles.filesList}>
          <Text style={styles.filesTitle}>Archivos subidos ({files.length})</Text>
          {files.map((file, index) => (
            <View key={index} style={styles.fileItem}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <TouchableOpacity onPress={() => removeFile(index)}>
                <Text style={styles.removeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginVertical: 16,
  },
  uploadButton: {
    backgroundColor: '#0057FF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadIcon: {
    fontSize: 20,
  },
  uploadText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  filesList: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  filesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  fileItem: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#0057FF',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  removeIcon: {
    fontSize: 16,
    color: '#999',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
})
