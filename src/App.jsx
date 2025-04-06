import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isBefore, setHours, setMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const meals = ['早', '中', '晚'];
const mealDeadlines = [6, 9, 14];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [names, setNames] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const currentStart = format(startDay, 'yyyy-MM-dd');
  const currentEnd = format(addDays(startDay, 6), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  const fetchData = async () => {
    const { data: rows } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('meal_date', currentStart)
      .lte('meal_date', currentEnd);

    const grouped = {};
    rows.forEach(row => {
      const key = row.user_name;
      if (!grouped[key]) grouped[key] = { name: row.user_name, count: 1, plans: {} };
      grouped[key].plans[`${row.meal_date}-${row.meal_type}`] = row.meal_count;
    });

    const inferred = Object.values(grouped).map(u => {
      const mealCounts = Object.values(u.plans);
      const avgCount = mealCounts.length ? Math.round(mealCounts.reduce((a, b) => a + b, 0) / mealCounts.length) : 1;
      return { ...u, count: avgCount };
    });

    setNames(inferred);
  };

  const openEditor = (user) => {
    if (window.confirm(`你确定要修改 ${user.name} 的用餐计划吗？`)) {
      setEditingUser(user);
    }
  };

  const saveEdits = async () => {
    const updated = { ...editingUser };
    await supabase.from('meal_plan').delete().eq('user_name', updated.name).gte('meal_date', currentStart).lte('meal_date', currentEnd);

    const inserts = Object.entries(updated.plans).map(([key, val]) => {
      const [date, meal] = key.split('-');
      return {
        user_name: updated.name,
        meal_date: date,
        meal_type: meal,
        meal_count: updated.count,
      };
    });

    if (inserts.length) {
      await supabase.from('meal_plan').upsert(inserts);
    }
    setEditingUser(null);
    fetchData();
  };

  const togglePlan = (key) => {
    const copy = { ...editingUser };
    if (copy.plans[key]) {
      delete copy.plans[key];
    } else {
      copy.plans[key] = copy.count;
    }
    setEditingUser(copy);
  };

  const getMealCount = (day, meal) => {
    return names.reduce((sum, user) => {
      const key = `${format(day, 'yyyy-MM-dd')}-${meal}`;
      return sum + (user.plans?.[key] ? user.count : 0);
    }, 0);
  };

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">升龙公司德合厂用餐计划表</h2>
      <div className="flex items-center justify-between mb-6">
        <ChevronLeft className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} />
        <span className="text-xl font-semibold">
          {format(startDay, 'dd/MM/yyyy')} - {format(addDays(startDay, 6), 'dd/MM/yyyy')}
        </span>
        <ChevronRight className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} />
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">姓名</th>
            <th className="border p-2">用餐人数</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="border p-2" colSpan={3}>
                {format(addDays(startDay, idx), 'dd/MM EEE', { locale: zhCN })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((user, idx) => (
            <tr key={idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEditor(user)}>
              <td className="border p-2">{user.name}</td>
              <td className="border p-2">{user.count}</td>
              {[...Array(7)].map((_, dayIdx) => (
                meals.map((meal) => {
                  const day = format(addDays(startDay, dayIdx), 'yyyy-MM-dd');
                  const checked = !!user.plans?.[`${day}-${meal}`];
                  return (
                    <td key={`${dayIdx}-${meal}`} className="border p-1 text-center">
                      <input type="checkbox" checked={checked} disabled readOnly />
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
          <tr className="bg-gray-200 font-bold">
            <td className="border p-2" colSpan={2}>合计人数</td>
            {[...Array(7)].map((_, dayIdx) => (
              meals.map((meal) => (
                <td key={`total-${dayIdx}-${meal}`} className="border p-1 text-center">
                  {getMealCount(addDays(startDay, dayIdx), meal)}
                </td>
              ))
            ))}
          </tr>
        </tbody>
      </table>

      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-3xl">
            <h3 className="text-xl font-semibold mb-4">编辑：{editingUser.name}</h3>
            <div className="mb-2">
              <label className="mr-2">用餐人数:</label>
              <input
                type="number"
                value={editingUser.count}
                onChange={(e) => setEditingUser({ ...editingUser, count: parseInt(e.target.value) || 1 })}
                className="border rounded px-2 py-1 w-20"
              />
            </div>
            <table className="min-w-full border">
              <thead>
                <tr>
                  {[...Array(7)].map((_, dayIdx) => (
                    <th key={dayIdx} colSpan={3} className="border px-2 py-1">
                      {format(addDays(startDay, dayIdx), 'dd/MM EEE', { locale: zhCN })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[...Array(7)].map((_, dayIdx) => (
                    meals.map((meal) => {
                      const date = format(addDays(startDay, dayIdx), 'yyyy-MM-dd');
                      const key = `${date}-${meal}`;
                      return (
                        <td key={key} className="border p-1 text-center">
                          <input
                            type="checkbox"
                            checked={!!editingUser.plans[key]}
                            onChange={() => togglePlan(key)}
                          />
                        </td>
                      );
                    })
                  ))}
                </tr>
              </tbody>
            </table>
            <div className="flex justify-end gap-4 mt-4">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 border rounded">取消</button>
              <button onClick={saveEdits} className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlanner;
