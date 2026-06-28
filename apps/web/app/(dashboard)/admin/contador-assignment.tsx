'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Company {
  id: string;
  name: string;
  contador_general_id?: string;
  contador_general_email?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name?: string;
}

export default function ContadorAssignmentPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedContador, setSelectedContador] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar empresas
        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .order('name');

        if (companiesData) {
          // Enriquecer con información de contador asignado
          const companiesWithContador = await Promise.all(
            companiesData.map(async (company) => {
              const { data: assignment } = await supabase
                .from('contador_general_assignments')
                .select('contador_id')
                .eq('company_id', company.id)
                .single();

              if (assignment) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('email')
                  .eq('id', assignment.contador_id)
                  .single();

                return {
                  ...company,
                  contador_general_id: assignment.contador_id,
                  contador_general_email: profile?.email,
                };
              }
              return company;
            })
          );

          setCompanies(companiesWithContador);
        }

        // Cargar perfiles (potenciales contadores)
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .order('email');

        if (profilesData) setProfiles(profilesData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAssign = async () => {
    if (!selectedCompany || !selectedContador) return;

    setSaving(true);
    try {
      // Verificar si ya existe asignación
      const { data: existing } = await supabase
        .from('contador_general_assignments')
        .select('id')
        .eq('company_id', selectedCompany)
        .single();

      if (existing) {
        // Actualizar
        await supabase
          .from('contador_general_assignments')
          .update({ contador_id: selectedContador })
          .eq('company_id', selectedCompany);
      } else {
        // Insertar
        await supabase
          .from('contador_general_assignments')
          .insert({
            company_id: selectedCompany,
            contador_id: selectedContador,
          });
      }

      // Refrescar datos
      const { data: updatedCompanies } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (updatedCompanies) {
        const companiesWithContador = await Promise.all(
          updatedCompanies.map(async (company) => {
            const { data: assignment } = await supabase
              .from('contador_general_assignments')
              .select('contador_id')
              .eq('company_id', company.id)
              .single();

            if (assignment) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', assignment.contador_id)
                .single();

              return {
                ...company,
                contador_general_id: assignment.contador_id,
                contador_general_email: profile?.email,
              };
            }
            return company;
          })
        );

        setCompanies(companiesWithContador);
      }

      setSelectedCompany(null);
      setSelectedContador(null);
    } catch (error) {
      console.error('Error assigning contador:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asignar Contador General</h1>
        <p className="text-gray-600">Configura qué contador general accede a qué empresa</p>
      </div>

      {/* Panel de asignación */}
      <Card>
        <CardHeader>
          <CardTitle>Nueva Asignación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Selector de empresa */}
            <div>
              <label className="block text-sm font-medium mb-2">Empresa</label>
              <select
                value={selectedCompany || ''}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de contador */}
            <div>
              <label className="block text-sm font-medium mb-2">Contador General</label>
              <select
                value={selectedContador || ''}
                onChange={(e) => setSelectedContador(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Selecciona un contador</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón asignar */}
            <div className="flex items-end">
              <Button
                onClick={handleAssign}
                disabled={!selectedCompany || !selectedContador || saving}
                className="w-full"
              >
                {saving ? 'Asignando...' : 'Asignar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de asignaciones existentes */}
      <Card>
        <CardHeader>
          <CardTitle>Asignaciones Actuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded border"
              >
                <div>
                  <p className="font-medium">{company.name}</p>
                  <p className="text-sm text-gray-600">
                    Contador: {company.contador_general_email || 'Sin asignar'}
                  </p>
                </div>
                {company.contador_general_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCompany(company.id);
                      setSelectedContador(company.contador_general_id!);
                    }}
                  >
                    Cambiar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
